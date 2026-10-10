import test from 'node:test';
import assert from 'node:assert/strict';

test('Import JSON validation rejects malformed and non-object inputs', async () => {
  // Mock localStorage
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = v; },
    removeItem: (k) => { delete storage[k]; },
  };

  const { store } = await import('../src/lib/store.js');

  const invalid1 = store.importJSON('not a json');
  assert.equal(invalid1.success, false);

  const invalid2 = store.importJSON('{"randomKey": 123}');
  assert.equal(invalid2.success, false);
  assert.ok(invalid2.error.includes('valid budget tracker data'));

  const valid = store.importJSON(JSON.stringify({
    categories: [
      { id: 'cat-groceries', name: 'Groceries', emoji: '🛒', color: '#BFE3F7', monthly_limit: 5000 }
    ],
    transactions: []
  }));

  assert.equal(valid.success, true);
  // Verify user's 'Groceries' category was preserved and NOT deleted!
  const hasGroceries = store.getCategories().some(c => c.name === 'Groceries');
  assert.ok(hasGroceries, 'Custom user category like Groceries must be preserved');
});

test('store.updateTransaction updates amount, note, and category without breaking list order', async () => {
  const { store } = await import('../src/lib/store.js');

  // Add sample transaction
  const initial = store.addTransaction({
    type: 'income',
    amount: 25000,
    note: 'Initial Paycheck',
    date: '2026-10-10'
  });

  assert.equal(initial.amount, 25000);
  assert.equal(initial.note, 'Initial Paycheck');

  // Update transaction
  const updated = store.updateTransaction(initial.id, {
    amount: 28000,
    note: 'Bonus Included Paycheck',
  });

  assert.equal(updated.amount, 28000);
  assert.equal(updated.note, 'Bonus Included Paycheck');

  // Check store retrieval
  const found = store.getTransactions().find(t => t.id === initial.id);
  assert.equal(found.amount, 28000);
  assert.equal(found.note, 'Bonus Included Paycheck');

  // Clean up
  store.deleteTransaction(initial.id);
});

test('store.getCutoffCategorySpending supports deposits/rollover into envelopes with 0 allocated budget', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();
  const miscCat = store.getCategories().find(c => c.name.toLowerCase().includes('misc')) || store.getCategories()[0];

  // Set explicit limit 0 for misc in this cutoff
  store.updateCutoffCategoryLimit(cutoff.id, miscCat.id, 0);

  // Add income / rollover deposit specifically tagged to Misc envelope
  const depositTx = store.addTransaction({
    type: 'income',
    amount: 250,
    note: 'excess from last cut off',
    date: cutoff.start,
    category: miscCat.id
  });

  const spending = store.getCutoffCategorySpending(cutoff);
  const miscSpending = spending.find(s => s.id === miscCat.id);

  assert.ok(miscSpending, 'Misc envelope spending record must exist');
  assert.equal(miscSpending.deposited, 250, 'Deposited amount should be 250');
  assert.equal(miscSpending.totalFunds, 250, 'Total funds should be 250 even with 0 allocated budget');
  assert.equal(miscSpending.remaining, 250, 'Remaining should be 250');

  // Add expense spending from this envelope
  const expenseTx = store.addTransaction({
    type: 'expense',
    amount: 100,
    note: 'snack',
    date: cutoff.start,
    category: miscCat.id,
    skipBudgetCheck: true
  });

  const spendingAfter = store.getCutoffCategorySpending(cutoff);
  const miscSpendingAfter = spendingAfter.find(s => s.id === miscCat.id);

  assert.equal(miscSpendingAfter.spent, 100);
  assert.equal(miscSpendingAfter.remaining, 150, 'Remaining should be 250 - 100 = 150');

  // Clean up
  store.deleteTransaction(depositTx.id);
  store.deleteTransaction(expenseTx.id);
});

test('store.getPendingPayday returns null when paycheck has been entered or dismissed', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();

  // Test dismissPayday persists paycheckDismissed
  store.dismissPayday(cutoff.id);
  const pendingAfterDismiss = store.getPendingPayday();
  assert.equal(pendingAfterDismiss, null, 'Pending payday must be null after dismissal');

  // Reset cutoff state
  store.saveCutoffRecord({ id: cutoff.id, paycheckDismissed: false, salaryConfirmed: false });

  // Add salary transaction for this cutoff
  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 8328,
    note: `Salary – ${cutoff.label}`,
    date: cutoff.start,
    category: 'cat-income'
  });

  const pendingAfterSalary = store.getPendingPayday();
  assert.equal(pendingAfterSalary, null, 'Pending payday must be null when salary income exists');

  // Clean up
  store.deleteTransaction(salaryTx.id);
});

test('store hiram / loan tracking minuses from envelope and repayLoan restores funds', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();
  const allowanceCat = store.getCategories().find(c => c.name.toLowerCase().includes('allowance')) || store.getCategories()[0];

  // Lend money (hiram)
  const loanTx = store.addTransaction({
    type: 'expense',
    amount: 1000,
    note: 'ate trish (hiram)',
    date: cutoff.start,
    category: allowanceCat.id,
    isLoan: true,
    borrowerName: 'ate trish',
    loanStatus: 'unpaid',
    skipBudgetCheck: true
  });

  assert.equal(loanTx.isLoan, true);
  assert.equal(loanTx.loanStatus, 'unpaid');

  // Check getCutoffLoans
  const loans = store.getCutoffLoans(cutoff);
  const foundLoan = loans.find(l => l.id === loanTx.id);
  assert.ok(foundLoan, 'Loan must be tracked in cutoff loans');
  assert.equal(foundLoan.borrowerName, 'ate trish');
  assert.equal(foundLoan.amount, 1000);

  // Repay loan
  const result = store.repayLoan(loanTx.id);
  assert.ok(result, 'Repayment should return result object');
  assert.equal(result.repaymentTx.type, 'income');
  assert.equal(result.repaymentTx.amount, 1000);
  assert.equal(result.repaymentTx.categoryId, allowanceCat.id, 'Repayment must return funds to the original envelope');

  // Verify original transaction is marked repaid
  const updatedLoanTx = store.getTransactions().find(t => t.id === loanTx.id);
  assert.equal(updatedLoanTx.loanStatus, 'repaid');

  // Clean up
  store.deleteTransaction(loanTx.id);
  store.deleteTransaction(result.repaymentTx.id);
});

test('loans deducted from Cutoff Allowance do not count as daily consumable spending and avoid negative day status', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();
  const testDate = cutoff.start;

  // Add loan transaction deducted from Cutoff Allowance
  const loanTx = store.addTransaction({
    type: 'expense',
    amount: 1000,
    note: 'ate trish (hiram)',
    date: testDate,
    categoryId: 'cat-daily',
    isLoan: true,
    borrowerName: 'ate trish',
    loanStatus: 'unpaid',
    skipBudgetCheck: true
  });

  const dailySpending = store.getDailySpending(testDate, testDate);
  const dayData = dailySpending[testDate];

  assert.ok(dayData, 'Day data must exist');
  assert.equal(dayData.spent, 0, 'Consumable daily spent must be 0, not 1000');
  assert.equal(dayData.loansLent, 1000, 'loansLent must record the 1000 loan');

  const dayStatus = store.getDayStatus(testDate);
  assert.equal(dayStatus.spent, 0, 'dayStatus.spent must exclude loans');
  assert.notEqual(dayStatus.status, 'over', 'Day must NOT be marked as overspent due to loan');

  // Clean up
  store.deleteTransaction(loanTx.id);
});

test('unpaid loan reduces envelope set budget from 2000 to 1000, and repayment restores it to 2000', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();
  const allowanceCat = store.getCategories().find(c => c.name.toLowerCase().includes('allowance')) || store.getCategories()[0];

  // Set up salary income for cutoff so spend budget exists
  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 10000,
    date: cutoff.start,
    categoryId: 'cat-income',
    skipBudgetCheck: true
  });

  // Set explicit limit of 2000 for this envelope in this cutoff
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 2000);

  // Lend 1000 from this envelope
  const loanTx = store.addTransaction({
    type: 'expense',
    amount: 1000,
    note: 'ate trish (hiram)',
    date: cutoff.start,
    categoryId: allowanceCat.id,
    isLoan: true,
    borrowerName: 'ate trish',
    loanStatus: 'unpaid',
    skipBudgetCheck: true
  });

  const spendingWhileLoan = store.getCutoffCategorySpending(cutoff);
  const catWhileLoan = spendingWhileLoan.find(c => c.id === allowanceCat.id);

  assert.equal(catWhileLoan.unpaidLoans, 1000, 'Unpaid loans should be 1000');
  assert.equal(catWhileLoan.period_limit, 1000, 'Set budget must be reduced from 2000 to 1000');
  assert.equal(catWhileLoan.totalFunds, 1000, 'Total funds must be 1000');
  assert.equal(catWhileLoan.spent, 0, 'Consumable spent must remain 0');
  assert.equal(catWhileLoan.remaining, 1000, 'Remaining must be 1000');

  // Repay the loan
  const result = store.repayLoan(loanTx.id);

  const spendingAfterRepay = store.getCutoffCategorySpending(cutoff);
  const catAfterRepay = spendingAfterRepay.find(c => c.id === allowanceCat.id);

  assert.equal(catAfterRepay.unpaidLoans, 0, 'Unpaid loans should be 0 after repayment');
  assert.equal(catAfterRepay.period_limit, 2000, 'Set budget must restore to 2000 upon repayment');
  assert.equal(catAfterRepay.totalFunds, 2000, 'Total funds must restore to 2000');
  assert.equal(catAfterRepay.remaining, 2000, 'Remaining must restore to 2000');

  // Clean up
  store.deleteTransaction(loanTx.id);
  store.deleteTransaction(result.repaymentTx.id);
  store.deleteTransaction(salaryTx.id);
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 0);
});

test('store.addTransaction rejects expenses that exceed envelope budget or when envelope has 0 budget', async () => {
  const { store } = await import('../src/lib/store.js');

  const cutoff = store.getCurrentCutoff();
  const cat = store.getCategories().find(c => c.name.toLowerCase().includes('allowance')) || store.getCategories()[0];

  // Set explicit cutoff limit of 1000 for this category
  store.updateCutoffCategoryLimit(cutoff.id, cat.id, 1000);

  // Set up salary income for cutoff so spend budget exists
  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 10000,
    date: cutoff.start,
    categoryId: 'cat-income',
    skipBudgetCheck: true
  });

  // Attempting to spend 1500 when envelope budget is only 1000 must throw an error!
  assert.throws(() => {
    store.addTransaction({
      type: 'expense',
      amount: 1500,
      note: 'Big dinner',
      date: cutoff.start,
      categoryId: cat.id
    });
  }, /Exceeds ".*" envelope budget!/);

  // Attempting to spend 800 (within 1000) should succeed
  const validExpense = store.addTransaction({
    type: 'expense',
    amount: 800,
    note: 'Reasonable dinner',
    date: cutoff.start,
    categoryId: cat.id
  });
  assert.equal(validExpense.amount, 800);

  // Now only 200 remaining in envelope; spending 300 more must throw
  assert.throws(() => {
    store.addTransaction({
      type: 'expense',
      amount: 300,
      note: 'Extra snack',
      date: cutoff.start,
      categoryId: cat.id
    });
  }, /Exceeds ".*" envelope budget!/);

  // Category with 0 budget: create or set 0 limit
  const zeroCat = store.getCategories().find(c => c.id !== cat.id && c.id !== 'cat-income');
  if (zeroCat) {
    store.updateCutoffCategoryLimit(cutoff.id, zeroCat.id, 0);
    assert.throws(() => {
      store.addTransaction({
        type: 'expense',
        amount: 50,
        note: 'Unauthorized purchase',
        date: cutoff.start,
        categoryId: zeroCat.id
      });
    }, /has no allocated budget/);
  }

  // Clean up
  store.deleteTransaction(salaryTx.id);
  store.deleteTransaction(validExpense.id);
});

test('store.getAllLoans retains loans across different cutoffs until explicitly deleted', async () => {
  const { store } = await import('../src/lib/store.js');

  // Loan 1 from previous cutoff
  const loanPast = store.addTransaction({
    type: 'expense',
    amount: 1500,
    note: 'Kuya Marco (hiram)',
    date: '2026-09-15',
    isLoan: true,
    borrowerName: 'Kuya Marco',
    loanStatus: 'unpaid',
    skipBudgetCheck: true
  });

  // Loan 2 from current cutoff
  const curCutoff = store.getCurrentCutoff();
  const loanCurrent = store.addTransaction({
    type: 'expense',
    amount: 500,
    note: 'Ate Trish (hiram)',
    date: curCutoff.start,
    isLoan: true,
    borrowerName: 'Ate Trish',
    loanStatus: 'repaid',
    skipBudgetCheck: true
  });

  const allLoans = store.getAllLoans();
  assert.ok(allLoans.some(l => l.id === loanPast.id), 'Past cutoff loan must remain in allLoans');
  assert.ok(allLoans.some(l => l.id === loanCurrent.id), 'Current cutoff loan must be in allLoans');

  // Delete repaid loan
  store.deleteTransaction(loanCurrent.id);
  const afterDelete = store.getAllLoans();
  assert.ok(!afterDelete.some(l => l.id === loanCurrent.id), 'Deleted loan must be removed');
  assert.ok(afterDelete.some(l => l.id === loanPast.id), 'Unpaid past loan must STILL remain');

  // Clean up
  store.deleteTransaction(loanPast.id);
});

test('Miscellaneous is exempt from requiring set budget, while other envelopes strictly require budget', async () => {
  const { store } = await import('../src/lib/store.js');

  const curCutoff = store.getCurrentCutoff();
  const txDate = curCutoff.start;

  // Log income to establish spend budget
  const incomeTx = store.addTransaction({
    type: 'income',
    amount: 10000,
    note: 'Cutoff Salary',
    date: txDate,
    skipBudgetCheck: true
  });

  // Ensure cat-misc has 0 limit
  store.updateCutoffCategoryLimit(curCutoff.id, 'cat-misc', 0);

  // Miscellaneous expense with 0 allocated budget must SUCCEED!
  const miscTx = store.addTransaction({
    type: 'expense',
    amount: 300,
    note: 'Flex expense in misc',
    date: txDate,
    categoryId: 'cat-misc'
  });
  assert.ok(miscTx.id, 'Expense in Miscellaneous without allocated budget must succeed');

  // Non-misc envelope with 0 budget must FAIL!
  const otherCat = store.getCategories().find(c => c.id !== 'cat-misc' && !c.name.toLowerCase().includes('income'));
  if (otherCat) {
    store.updateCutoffCategoryLimit(curCutoff.id, otherCat.id, 0);
    assert.throws(() => {
      store.addTransaction({
        type: 'expense',
        amount: 100,
        note: 'Other expense with 0 budget',
        date: txDate,
        categoryId: otherCat.id
      });
    }, /has no allocated budget/);
  }

  // Clean up
  store.deleteTransaction(miscTx.id);
  store.deleteTransaction(incomeTx.id);
});






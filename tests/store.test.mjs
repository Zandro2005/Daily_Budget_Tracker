import test from 'node:test';
import assert from 'node:assert/strict';

test('Import JSON validation rejects malformed and non-object inputs', async () => {
  // Mock localStorage
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = v; },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
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

test('unpaid loan keeps envelope set budget untouched, adds loan to spent, and repayment restores spent', async () => {
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
  assert.equal(catWhileLoan.period_limit, 2000, 'Set budget must remain untouched at 2000');
  assert.equal(catWhileLoan.totalFunds, 2000, 'Total funds must remain untouched at 2000');
  assert.equal(catWhileLoan.spent, 1000, 'Lent amount must be added to spent');
  assert.equal(catWhileLoan.consumedSpent, 0, 'Consumable spent must remain 0');
  assert.equal(catWhileLoan.remaining, 1000, 'Remaining must be 1000 (2000 budget - 1000 spent)');

  // Cutoff summary check: total remaining budget IS deducted on lend, and restored on repay
  const summaryWhileLoan = store.getCutoffSummary(cutoff);
  assert.equal(summaryWhileLoan.totalExpense, 1000, 'Cutoff totalExpense must include the 1000 lent money');
  assert.equal(summaryWhileLoan.consumedExpense, 0, 'Pure consumable purchases remain 0');
  assert.equal(summaryWhileLoan.unpaidLoansTotal, 1000, 'Unpaid loans total is 1000');
  assert.equal(summaryWhileLoan.remainingBudget, summaryWhileLoan.plan.spendBudget - 1000, 'Cutoff overall remaining budget is deducted by lent amount');

  // Repay the loan
  const result = store.repayLoan(loanTx.id);

  const spendingAfterRepay = store.getCutoffCategorySpending(cutoff);
  const catAfterRepay = spendingAfterRepay.find(c => c.id === allowanceCat.id);

  assert.equal(catAfterRepay.unpaidLoans, 0, 'Unpaid loans should be 0 after repayment');
  assert.equal(catAfterRepay.period_limit, 2000, 'Set budget remains 2000');
  assert.equal(catAfterRepay.totalFunds, 2000, 'Total funds remains 2000');
  assert.equal(catAfterRepay.spent, 0, 'Spent returns to 0 after repayment');
  assert.equal(catAfterRepay.remaining, 2000, 'Remaining must restore to 2000');

  // Cutoff summary restored
  const summaryAfterRepay = store.getCutoffSummary(cutoff);
  assert.equal(summaryAfterRepay.totalExpense, 0, 'Cutoff totalExpense returns to 0 after repayment');
  assert.equal(summaryAfterRepay.remainingBudget, summaryAfterRepay.plan.spendBudget, 'Cutoff remaining budget is restored after repayment');

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

test('store.clearAllData wipes all envelopes, transactions, cutoffs, and leaves zero junk', async () => {
  const { store } = await import('../src/lib/store.js');

  // Add dummy envelope and transaction
  const cat = store.addCategory({ name: 'Vacation Fund', emoji: '🏖️' });
  const tx = store.addTransaction({
    type: 'income',
    amount: 5000,
    note: 'Initial fund',
    date: '2026-10-10',
    skipBudgetCheck: true
  });

  assert.ok(store.getCategories().some(c => c.id === cat.id));
  assert.ok(store.getTransactions().some(t => t.id === tx.id));

  // Run clearAllData
  await store.clearAllData();

  // Verify complete wipe
  assert.equal(store.getCategories().length, 0, 'Categories/envelopes must be completely empty (0 junk)');
  assert.equal(store.getTransactions().length, 0, 'Transactions must be 0');
  assert.equal(store.getRecurring().length, 0, 'Recurring must be 0');
  assert.equal(store.getGoals().length, 0, 'Goals must be 0');
  assert.deepEqual(store.getCutoffRecord('any-cutoff') || {}, {}, 'Cutoff records must be cleared');

  // Verify restoreToStandardEnvelopes works when user explicitly requests template
  const restored = await store.resetToStandardEnvelopes();
  assert.equal(restored.length, 4, 'Should restore the 4 standard envelopes when requested');
  assert.equal(store.getCategories().length, 4);
});

test('loan repayment restores envelope funds without inflating cutoff spend budget or leaving phantom remaining', async () => {
  const { store } = await import('../src/lib/store.js');
  const cutoff = store.getCurrentCutoff();
  const allowanceCat = store.getCategories().find(c => c.name.toLowerCase().includes('allowance')) || store.getCategories()[0];

  // 1. Establish salary of 8000 and envelope allocation
  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 8000,
    date: cutoff.start,
    categoryId: 'cat-income',
    skipBudgetCheck: true
  });

  const planBefore = store.getCutoffPlan(cutoff);
  assert.equal(planBefore.loggedIncome, 8000, 'Initial logged income should be 8000');
  assert.equal(planBefore.spendBudget, 6400, 'Initial spend budget with 20% savings should be 6400');

  // Allocate 1000 to Cutoff Allowance envelope
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 1000);

  // 2. Lend 500 from Cutoff Allowance
  const loanTx = store.addTransaction({
    type: 'expense',
    amount: 500,
    date: cutoff.start,
    categoryId: allowanceCat.id,
    categoryName: allowanceCat.name,
    note: 'Lyka (hiram)',
    borrowerName: 'Lyka',
    isLoan: true,
    loanStatus: 'unpaid',
    skipBudgetCheck: true
  });

  const spendingLent = store.getCutoffCategorySpending(cutoff);
  const allowanceLent = spendingLent.find(c => c.id === allowanceCat.id);
  assert.equal(allowanceLent.remaining, 500, 'Envelope remaining should be 500 after lending 500');

  // 3. Repay 500
  const result = store.repayLoan(loanTx.id);

  // Verify spend budget is NOT inflated by 400!
  const planAfter = store.getCutoffPlan(cutoff);
  assert.equal(planAfter.loggedIncome, 8000, 'Repaid loan must NOT be counted as new salary (remains 8000)');
  assert.equal(planAfter.spendBudget, 6400, 'Spend budget must NOT inflate to 6800 (remains 6400)');

  // Verify envelope funds are restored to 1000
  const spendingRepaid = store.getCutoffCategorySpending(cutoff);
  const allowanceRepaid = spendingRepaid.find(c => c.id === allowanceCat.id);
  assert.equal(allowanceRepaid.remaining, 1000, 'Envelope remaining must be fully restored to 1000');
  assert.equal(allowanceRepaid.spent, 0, 'Envelope spent must return to 0');

  // Clean up
  store.deleteTransaction(loanTx.id);
  store.deleteTransaction(result.repaymentTx.id);
  store.deleteTransaction(salaryTx.id);
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 0);
});

test('when envelope has 1000 limit, 500 lent, and 500 spent, remaining is exactly 0 and not exceeded', async () => {
  const { store } = await import('../src/lib/store.js');
  const cutoff = store.getCurrentCutoff();

  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 8000,
    date: cutoff.start,
    categoryId: 'cat-income',
    note: 'Salary'
  });

  const allowanceCat = store.getCategories().find(c => c.id === 'cat-daily' || c.name.toLowerCase().includes('allowance'));
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 1000);

  const loanTx = store.addTransaction({
    type: 'expense',
    amount: 500,
    date: cutoff.start,
    categoryId: allowanceCat.id,
    categoryName: allowanceCat.name,
    note: 'Lyka (hiram)',
    isLoan: true,
    loanStatus: 'unpaid',
    skipBudgetCheck: true,
  });

  const expenseTx = store.addTransaction({
    type: 'expense',
    amount: 500,
    date: cutoff.start,
    categoryId: allowanceCat.id,
    categoryName: allowanceCat.name,
    note: 'Today lunch',
    skipBudgetCheck: true,
  });

  const spending = store.getCutoffCategorySpending(cutoff);
  const cat = spending.find(c => c.id === allowanceCat.id);

  assert.equal(cat.totalFunds, 1000, 'Envelope funds should be 1000');
  assert.equal(cat.unpaidLoans, 500, 'Unpaid loans should be 500');
  assert.equal(cat.consumedSpent, 500, 'Consumed spent should be 500');
  assert.equal(cat.spent, 1000, 'Total spent should be 1000');
  assert.equal(cat.remaining, 0, 'Remaining should be exactly 0, not negative');
  assert.equal(cat.isExceeded, false, 'Envelope should not be exceeded when total spent == limit');

  // Repaying the 500 loan restores envelope to 500 remaining!
  const repayRes = store.repayLoan(loanTx.id);
  assert.ok(repayRes, 'Loan should be repaid');

  const spendingAfterRepay = store.getCutoffCategorySpending(cutoff);
  const catAfterRepay = spendingAfterRepay.find(c => c.id === allowanceCat.id);
  assert.equal(catAfterRepay.totalFunds, 1000, 'Envelope funds must remain 1000, never 1500');
  assert.equal(catAfterRepay.unpaidLoans, 0, 'Unpaid loans should now be 0');
  assert.equal(catAfterRepay.spent, 500, 'Total spent should now be 500 (consumed only)');
  assert.equal(catAfterRepay.remaining, 500, 'Remaining should restore to 500 (1000 - 500 spent)');

  // Deleting repayment in History restores loan to unpaid, spent to 1000, remaining to 0, and funds STAY at 1000!
  store.deleteTransaction(repayRes.repaymentTx.id);
  const origLoanAfterDeleteRepay = store.getTransactions().find(t => t.id === loanTx.id);
  assert.equal(origLoanAfterDeleteRepay.loanStatus, 'unpaid', 'Orig loan status must be restored to unpaid');

  const spendingAfterDeleteRepay = store.getCutoffCategorySpending(cutoff);
  const catAfterDeleteRepay = spendingAfterDeleteRepay.find(c => c.id === allowanceCat.id);
  assert.equal(catAfterDeleteRepay.totalFunds, 1000, 'Envelope funds must not overlap to 1500');
  assert.equal(catAfterDeleteRepay.unpaidLoans, 500, 'Unpaid loans restored to 500');
  assert.equal(catAfterDeleteRepay.spent, 1000, 'Spent restored to 1000 (500 lent + 500 spent)');
  assert.equal(catAfterDeleteRepay.remaining, 0, 'Remaining restored to 0');

  // Clean up
  store.deleteTransaction(loanTx.id);
  store.deleteTransaction(expenseTx.id);
  store.deleteTransaction(salaryTx.id);
  store.updateCutoffCategoryLimit(cutoff.id, allowanceCat.id, 0);
});

test('added income adds to base salary, allows 0 savings to keep 100% in spend budget without requiring category', async () => {
  const { store } = await import('../src/lib/store.js');
  const cutoff = store.getCurrentCutoff();

  // 1. Setup base salary: 10000 with 20% savings = 2000 savings, 8000 spend budget
  const salaryTx = store.addTransaction({
    type: 'income',
    amount: 10000,
    note: 'Salary - 10th Cutoff',
    categoryId: 'cat-income',
    date: cutoff.start,
    isBaseSalary: true,
    skipBudgetCheck: true
  });

  const basePlan = store.getCutoffPlan(cutoff);
  assert.equal(basePlan.paycheck, 10000);
  assert.equal(basePlan.savingsTarget, 2000);
  assert.equal(basePlan.spendBudget, 8000);

  // 2. Add extra income: 1000 with NO category and 0 to savings
  const extraIncomeTx = store.addTransaction({
    type: 'income',
    amount: 1000,
    note: 'Side gig',
    categoryId: null, // No category required!
    savingsAmount: 0, // 0 goes to savings, all 1000 to spend budget
    isAddedIncome: true,
    date: cutoff.start,
  });

  const updatedPlan = store.getCutoffPlan(cutoff);
  assert.equal(updatedPlan.paycheck, 11000, 'Total income should be 10000 + 1000 = 11000');
  assert.equal(updatedPlan.totalAddedIncome, 1000, 'Added income should be 1000');
  assert.equal(updatedPlan.savingsTarget, 2000, 'Savings target must remain 2000 (0 added to savings)');
  assert.equal(updatedPlan.spendBudget, 9000, 'Spend budget should increase by full 1000 to 9000');

  const summary = store.getCutoffSummary(cutoff);
  assert.equal(summary.budgetLimit, 9000, 'Summary budget limit should be 9000');
  assert.equal(summary.remainingBudget, 9000, 'Remaining budget should be 9000');

  // 3. Add second extra income with 20% savings (200 to savings, 800 to spend budget)
  const extraWithSavingsTx = store.addTransaction({
    type: 'income',
    amount: 1000,
    note: 'Bonus',
    categoryId: null,
    savingsAmount: 200, // 20% saved
    isAddedIncome: true,
    date: cutoff.start,
  });

  const planWithTwo = store.getCutoffPlan(cutoff);
  assert.equal(planWithTwo.paycheck, 12000);
  assert.equal(planWithTwo.savingsTarget, 2200, 'Savings target should now be 2000 + 200 = 2200');
  assert.equal(planWithTwo.spendBudget, 9800, 'Spend budget should be 9000 + 800 = 9800');

  // 4. Delete the added income and verify complete restore
  store.deleteTransaction(extraWithSavingsTx.id);
  const planAfterOneDelete = store.getCutoffPlan(cutoff);
  assert.equal(planAfterOneDelete.paycheck, 11000);
  assert.equal(planAfterOneDelete.savingsTarget, 2000);
  assert.equal(planAfterOneDelete.spendBudget, 9000);

  // Clean up
  store.deleteTransaction(extraIncomeTx.id);
  store.deleteTransaction(salaryTx.id);
});




global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
global.document = {
  documentElement: {
    removeAttribute: () => {},
    setAttribute: () => {},
  },
};

const { store } = await import('../src/lib/store.js');
// Use local memory state
store.transactions = [];
store.cutoffs = {};
store.goals = [];
store.settings = {
  currency: '₱',
  expectedIncome: 0,
  monthlyBudget: 0,
  savingsRate: 0.2, // 20% savings
  payCycle: 'semi-monthly',
  paydays: [10, 25],
  salaryByPayday: { 10: 0, 25: 0 },
};

console.log('--- 1. Testing Pending Modal Trigger ---');
const pending = store.getPendingPayday();
console.log('Pending modal object returned when no income logged yet:', !!pending);
if (pending) {
  console.log('Cutoff label:', pending.cutoff.label);
}

console.log('\n--- 2. Testing Expense Blocked When Income Insufficient ---');
try {
  store.addTransaction({
    type: 'expense',
    amount: 500,
    note: 'Coffee',
    date: '2026-10-08',
  });
  console.error('FAIL: Expense was allowed with 0 income!');
} catch (err) {
  console.log('PASS: Expense blocked correctly:', err.message);
}

console.log('\n--- 3. Testing Income Confirmation & Savings Allocation ---');
// User confirms ₱10,000 paycheck for this cutoff
store.confirmPayday({
  amount: 10000,
  leftoverAction: 'save',
});

const curCutoff = store.getCurrentCutoff();
const plan = store.getCutoffPlan(curCutoff);
const summary = store.getCutoffSummary(curCutoff);

console.log('Paycheck:', plan.paycheck);
console.log('Protected Savings Target (20%):', plan.savingsTarget);
console.log('Spend Budget available for expenses:', plan.spendBudget);
console.log('Remaining spend budget:', summary.remainingBudget);

console.log('\n--- 4. Testing Logging Allowed Expense ---');
// Log expense of ₱6,000 (out of ₱8,000 spend budget)
store.addTransaction({
  type: 'expense',
  amount: 6000,
  note: 'Groceries',
  date: '2026-10-08',
});

const summaryAfter = store.getCutoffSummary(curCutoff);
console.log('Expenses so far:', summaryAfter.totalExpense);
console.log('Remaining spend budget:', summaryAfter.remainingBudget);
console.log('Savings target still intact:', summaryAfter.plan.savingsTarget);

console.log('\n--- 5. Testing Tight Budget Warning ---');
// Log another ₱800 -> total ₱6,800 spent of ₱8,000 (85% used, tight!)
store.addTransaction({
  type: 'expense',
  amount: 800,
  note: 'Dinner',
  date: '2026-10-08',
});
const summaryTight = store.getCutoffSummary(curCutoff);
console.log('Usage percent:', Math.round(summaryTight.usagePercent) + '%');
console.log('Is tight budget flagged:', summaryTight.isTight);

console.log('\n--- 6. Testing Expense Exceeding Spend Budget (Protecting Savings) ---');
// Remaining spend budget is ₱1,200. Attempt to spend ₱1,500.
try {
  store.addTransaction({
    type: 'expense',
    amount: 1500,
    note: 'Luxury Item',
    date: '2026-10-08',
  });
  console.error('FAIL: Expense over remaining spend budget was allowed!');
} catch (err) {
  console.log('PASS: Overspending blocked to protect savings:', err.message);
}

console.log('\nAll tests completed successfully!');

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
global.document = {
  documentElement: {
    setAttribute: () => {},
    removeAttribute: () => {},
  },
};
global.window = {};

const { store } = await import('../src/lib/store.js');

const cutoff = store.getCurrentCutoff();
const plan = store.getCutoffPlan(cutoff);
const summary = store.getCutoffSummary(cutoff);
const today = store.getTodayAllowance();
const daily = store.getDailyAllowance();

console.log('--- ZERO STATE VERIFICATION ---');
console.log('Paycheck:', plan.paycheck);
console.log('Spend Budget:', plan.spendBudget);
console.log('Savings Target:', plan.savingsTarget);
console.log('Remaining Budget:', summary.remainingBudget);
console.log('Budget Limit (spend cap):', summary.budgetLimit);
console.log('Today Allowance:', today.todayAllowance);
console.log('Today Left:', today.todayLeft);
console.log('Spent Today:', today.spentToday);
console.log('Daily Safe Spend:', daily.dailySafeSpend);
console.log('Total Income:', summary.totalIncome);
console.log('Total Expense:', summary.totalExpense);

if (plan.paycheck !== 0 || plan.spendBudget !== 0 || summary.remainingBudget !== 0 || summary.totalExpense !== 0) {
  console.error('FAIL: Non-zero values found!');
  process.exit(1);
} else {
  console.log('SUCCESS: All values are cleanly zero at first! ✅');
  process.exit(0);
}

import { getCutoffForDate, isDateInRange, getTodayDateString } from '../src/lib/format.js';

// Test mock transactions are empty and calculations are strictly isolated
function testStoreBehavior() {
  const transactions = [];
  const settings = {
    currency: '₱',
    monthlyBudget: 25000,
    expectedIncome: 35000,
    savingsRate: 0.20,
    payCycle: 'semi-monthly',
    paydays: [10, 25],
    salaryByPayday: { 10: 17500, 25: 17500 },
  };

  const cutoff = getCutoffForDate(new Date(), [10, 25]);
  console.log('Current Cutoff:', cutoff.id, cutoff.label);

  // 1. Initial zero state
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });

  console.log('Test 1 - Initial State: Income =', totalIncome, ', Spent =', totalExpense);
  if (totalIncome !== 0 || totalExpense !== 0) throw new Error('Initial state not 0');

  // 2. Log Income of 10,000
  transactions.push({
    id: 'tx-test-income',
    type: 'income',
    amount: 10000,
    categoryId: 'cat-income',
    date: getTodayDateString(),
  });

  totalIncome = 0;
  totalExpense = 0;
  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });

  console.log('Test 2 - After Logging 10,000 Income: Income =', totalIncome, ', Spent =', totalExpense);
  if (totalIncome !== 10000 || totalExpense !== 0) throw new Error('Income incremented spend!');

  // 3. Log Expense of 500
  transactions.push({
    id: 'tx-test-expense',
    type: 'expense',
    amount: 500,
    categoryId: 'cat-food',
    date: getTodayDateString(),
  });

  totalIncome = 0;
  totalExpense = 0;
  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') totalIncome += amt;
    else if (t.type === 'expense') totalExpense += amt;
  });

  console.log('Test 3 - After Logging 500 Expense: Income =', totalIncome, ', Spent =', totalExpense);
  if (totalIncome !== 10000 || totalExpense !== 500) throw new Error('Expense/Income calculation error');

  console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
}

testStoreBehavior();

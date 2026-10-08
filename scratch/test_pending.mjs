// Mock minimal localStorage and test BudgetStore logic
const storeState = {};
global.localStorage = {
  getItem: (k) => storeState[k] || null,
  setItem: (k, v) => { storeState[k] = v; },
  removeItem: (k) => { delete storeState[k]; }
};

// Test getPendingPayday logic directly
function testLogic() {
  const settings = {
    currency: '₱',
    monthlyBudget: 0,
    expectedIncome: 0,
    savingsRate: 0.20,
    payCycle: 'semi-monthly',
    paydays: [10, 25],
    salaryByPayday: { 10: 0, 25: 0 },
  };

  const cutoffs = {};
  const transactions = [];

  // Cutoff for Oct 8 (today)
  // Paydays are 10 and 25
  // Current date: Oct 8 -> previous payday is Sep 25, next is Oct 10
  // So current cutoff is Sep 25 to Oct 9 (payday 10)
  const curCutoff = {
    id: 'cutoff-2026-10-10',
    payday: 10,
    start: '2026-09-25',
    end: '2026-10-09',
    label: 'Sep 25 – Oct 9'
  };

  const record = cutoffs[curCutoff.id]; // undefined
  const hasLoggedIncome = transactions.some(t => t.type === 'income'); // false

  const todayDate = new Date();
  const dayNum = todayDate.getDate(); // 8
  const paydays = settings.paydays || [10, 25];
  const isPayday = paydays.includes(dayNum); // false (8 !== 10 && 8 !== 25)

  console.log({
    dayNum,
    isPayday,
    hasLoggedIncome,
    shouldShowCondition1: !isPayday && hasLoggedIncome, // false
    record
  });
}

testLogic();

// Test logic for getPendingPayday and leftover going to savings
const testCutoff = { id: '2026-10-B', payday: 25, start: '2026-09-25', end: '2026-10-09' };
const prevCutoff = { id: '2026-09-A', payday: 10, start: '2026-09-10', end: '2026-09-24' };

function checkPending({ loggedIncome, salaryConfirmed, dayNum, paydays = [10, 25], scheduledSalary = 0 }) {
  if (salaryConfirmed) return null;
  const isPayday = paydays.includes(dayNum);
  const hasIncome = loggedIncome > 0;
  if (!isPayday && hasIncome) return null;
  return {
    cutoff: testCutoff,
    salary: scheduledSalary > 0 ? scheduledSalary : (loggedIncome || 0),
    isPayday,
    hasIncome,
  };
}

console.log('Test 1 - No income logged yet, today is Oct 8 (not payday):',
  checkPending({ loggedIncome: 0, salaryConfirmed: false, dayNum: 8 }) ? 'MODAL POPS UP (PASS)' : 'FAIL');

console.log('Test 2 - Income logged (₱15k), today is Oct 8 (not payday):',
  checkPending({ loggedIncome: 15000, salaryConfirmed: false, dayNum: 8 }) === null ? 'NO POPUP (PASS)' : 'FAIL');

console.log('Test 3 - Income logged (₱15k), today is Oct 10 (PAYDAY!):',
  checkPending({ loggedIncome: 15000, salaryConfirmed: false, dayNum: 10 }) ? 'MODAL POPS UP ON PAYDAY (PASS)' : 'FAIL');

console.log('Test 4 - No income logged, today is Oct 25 (PAYDAY!):',
  checkPending({ loggedIncome: 0, salaryConfirmed: false, dayNum: 25 }) ? 'MODAL POPS UP ON PAYDAY (PASS)' : 'FAIL');

console.log('Test 5 - Already confirmed for cutoff, today is Oct 10:',
  checkPending({ loggedIncome: 15000, salaryConfirmed: true, dayNum: 10 }) === null ? 'NO POPUP (PASS)' : 'FAIL');

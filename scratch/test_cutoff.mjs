import { getCutoffForDate, getPreviousCutoff, getNextCutoff, isDateInRange, formatShortRange } from '../src/lib/format.js';

console.log('--- Testing format helpers ---');

// Test Oct 8, 2026 (today)
const c1 = getCutoffForDate('2026-10-08');
console.log('Oct 8, 2026:', c1);
console.assert(c1.periodType === 'B', 'Oct 8 should be B period');
console.assert(c1.start === '2026-09-25', 'Start should be 2026-09-25');
console.assert(c1.end === '2026-10-09', 'End should be 2026-10-09');
console.assert(c1.payday === 25, 'Payday should be 25');

// Test Oct 10, 2026
const c2 = getCutoffForDate('2026-10-10');
console.log('Oct 10, 2026:', c2);
console.assert(c2.periodType === 'A', 'Oct 10 should be A period');
console.assert(c2.start === '2026-10-10', 'Start should be 2026-10-10');
console.assert(c2.end === '2026-10-24', 'End should be 2026-10-24');

// Test Oct 25, 2026
const c3 = getCutoffForDate('2026-10-25');
console.log('Oct 25, 2026:', c3);
console.assert(c3.periodType === 'B', 'Oct 25 should be B period');
console.assert(c3.start === '2026-10-25', 'Start should be 2026-10-25');
console.assert(c3.end === '2026-11-09', 'End should be 2026-11-09');

// Test previous of c2 (Oct 10-24 -> should be Sep 25 - Oct 9)
const prevC2 = getPreviousCutoff(c2);
console.log('Prev of Oct 10-24:', prevC2);
console.assert(prevC2.id === c1.id, 'Prev of Oct 10-24 should be 2026-09-B');

// Test next of c1 (Sep 25 - Oct 9 -> should be Oct 10-24)
const nextC1 = getNextCutoff(c1);
console.log('Next of Sep 25 - Oct 9:', nextC1);
console.assert(nextC1.id === c2.id, 'Next of Sep 25 - Oct 9 should be 2026-10-A');

// Test Jan 5, 2027 (belongs to 2026-12-B)
const cJan5 = getCutoffForDate('2027-01-05');
console.log('Jan 5, 2027:', cJan5);
console.assert(cJan5.id === '2026-12-B', 'Jan 5 should be 2026-12-B');
console.assert(cJan5.start === '2026-12-25', 'Start should be 2026-12-25');
console.assert(cJan5.end === '2027-01-09', 'End should be 2027-01-09');

console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');

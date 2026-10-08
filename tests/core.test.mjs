import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  stripEmojis,
  getCutoffForDate,
  getPreviousCutoff,
  getNextCutoff,
  isDateInRange,
  parseDate,
  toDateString
} from '../src/lib/format.js';

test('escapeHtml sanitizes malicious XSS strings', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Hello & "World" <foo>'), 'Hello &amp; &quot;World&quot; &lt;foo&gt;');
  assert.equal(escapeHtml("it's safe"), 'it&#39;s safe');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('formatCurrency formats amounts accurately', () => {
  assert.equal(formatCurrency(1500, '₱'), '₱ 1,500');
  assert.equal(formatCurrency(0, '₱'), '₱ 0');
  assert.equal(formatCurrency(-250, '$'), '-$ 250');
});

test('getCutoffForDate handles standard semi-monthly cutoffs (10th and 25th)', () => {
  // Oct 15, 2026 -> Cutoff A (Oct 10 to Oct 24)
  const cutoffA = getCutoffForDate(new Date(2026, 9, 15), [10, 25]);
  assert.equal(cutoffA.periodType, 'A');
  assert.equal(cutoffA.start, '2026-10-10');
  assert.equal(cutoffA.end, '2026-10-24');
  assert.equal(cutoffA.payday, 10);

  // Oct 28, 2026 -> Cutoff B (Oct 25 to Nov 9)
  const cutoffB = getCutoffForDate(new Date(2026, 9, 28), [10, 25]);
  assert.equal(cutoffB.periodType, 'B');
  assert.equal(cutoffB.start, '2026-10-25');
  assert.equal(cutoffB.end, '2026-11-09');
  assert.equal(cutoffB.payday, 25);

  // Nov 5, 2026 -> Belongs to previous month Cutoff B (Oct 25 to Nov 9)
  const cutoffEarly = getCutoffForDate(new Date(2026, 10, 5), [10, 25]);
  assert.equal(cutoffEarly.periodType, 'B');
  assert.equal(cutoffEarly.start, '2026-10-25');
  assert.equal(cutoffEarly.end, '2026-11-09');
});

test('getCutoffForDate does not produce YYYY-MM-00 on payday 1st ([1, 16])', () => {
  const cutoff = getCutoffForDate(new Date(2026, 9, 20), [1, 16]);
  assert.ok(!cutoff.start.includes('-00'));
  assert.ok(!cutoff.end.includes('-00'));
  assert.equal(cutoff.start, '2026-10-16');
  // Day before Nov 1 is Oct 31
  assert.equal(cutoff.end, '2026-10-31');
});

test('getCutoffForDate sorts unsorted paydays ([25, 10])', () => {
  const cutoff = getCutoffForDate(new Date(2026, 9, 15), [25, 10]);
  assert.equal(cutoff.periodType, 'A');
  assert.equal(cutoff.start, '2026-10-10');
  assert.equal(cutoff.end, '2026-10-24');
});

test('getCutoffForDate handles monthly paycycle with 1 payday', () => {
  const cutoff = getCutoffForDate(new Date(2026, 9, 15), [15], 'monthly');
  assert.equal(cutoff.periodType, 'M');
  assert.equal(cutoff.start, '2026-10-15');
  // Day before Nov 15 is Nov 14
  assert.equal(cutoff.end, '2026-11-14');
});

test('getPreviousCutoff and getNextCutoff step seamlessly across periods', () => {
  const cutoffA = getCutoffForDate(new Date(2026, 9, 15), [10, 25]);
  const prev = getPreviousCutoff(cutoffA, [10, 25]);
  assert.equal(prev.periodType, 'B');
  assert.equal(prev.start, '2026-09-25');
  assert.equal(prev.end, '2026-10-09');

  const next = getNextCutoff(cutoffA, [10, 25]);
  assert.equal(next.periodType, 'B');
  assert.equal(next.start, '2026-10-25');
  assert.equal(next.end, '2026-11-09');
});

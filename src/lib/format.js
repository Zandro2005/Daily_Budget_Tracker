// ====================================================================
// CLOUDY BUDGET - FORMATTING UTILITIES
// ====================================================================

export function formatCurrency(amount, currency = '₱') {
  const num = Math.round(Number(amount) || 0);
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return num < 0 ? `-${currency} ${formatted}` : `${currency} ${formatted}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function stripEmojis(str) {
  if (!str) return '';
  // Remove emojis and pictographic symbols and clean extra spaces
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

export function formatMonthName(yearMonthStr) {
  // Format "2026-10" to "October 2026"
  const [year, month] = yearMonthStr.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateString(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr);
  const parts = dateStr.slice(0, 10).split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/**
 * Returns the semi-monthly cutoff period for a given date.
 * Cutoff A: Day 10 to 24 of month
 * Cutoff B: Day 25 to Day 9 of following month
 */
export function getCutoffForDate(dateInput = new Date(), paydays = [10, 25]) {
  const d = dateInput instanceof Date ? dateInput : parseDate(dateInput);
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  const [p1, p2] = paydays; // usually 10, 25

  let startYear, startMonth, endYear, endMonth, periodType, paydayDay, nextPaydayDate;

  if (day >= p2) {
    // Cutoff B starting on 25th of current month
    startYear = y;
    startMonth = m;
    periodType = 'B';
    paydayDay = p2;

    const nextMDate = new Date(y, m, 1); // 1st of next month
    endYear = nextMDate.getFullYear();
    endMonth = nextMDate.getMonth() + 1;
    nextPaydayDate = `${endYear}-${pad2(endMonth)}-${pad2(p1)}`;
  } else if (day >= p1) {
    // Cutoff A starting on 10th of current month
    startYear = y;
    startMonth = m;
    endYear = y;
    endMonth = m;
    periodType = 'A';
    paydayDay = p1;
    nextPaydayDate = `${y}-${pad2(m)}-${pad2(p2)}`;
  } else {
    // Day 1 to 9 -> belongs to Cutoff B of PREVIOUS month
    const prevMDate = new Date(y, m - 2, 1);
    startYear = prevMDate.getFullYear();
    startMonth = prevMDate.getMonth() + 1;
    endYear = y;
    endMonth = m;
    periodType = 'B';
    paydayDay = p2;
    nextPaydayDate = `${y}-${pad2(m)}-${pad2(p1)}`;
  }

  const startDay = periodType === 'A' ? p1 : p2;
  const endDay = periodType === 'A' ? p2 - 1 : p1 - 1;

  const startDateStr = `${startYear}-${pad2(startMonth)}-${pad2(startDay)}`;
  const endDateStr = `${endYear}-${pad2(endMonth)}-${pad2(endDay)}`;

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  // Total calendar days inclusive
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Days left from `d` to `endDate` inclusive
  const curZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let daysLeft = Math.round((endDate - curZero) / (1000 * 60 * 60 * 24)) + 1;
  if (daysLeft < 1) daysLeft = 1;
  if (daysLeft > totalDays) daysLeft = totalDays;

  const id = `${startYear}-${pad2(startMonth)}-${periodType}`;
  const label = formatShortRange(startDateStr, endDateStr);

  return {
    id,
    periodType, // 'A' | 'B'
    payday: paydayDay,
    start: startDateStr,
    end: endDateStr,
    startDate,
    endDate,
    totalDays,
    daysLeft,
    nextPayday: nextPaydayDate,
    label,
  };
}

export function getPreviousCutoff(cutoff, paydays = [10, 25]) {
  const startDate = parseDate(cutoff.start);
  // Step 1 day before the start date
  const prevDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1);
  return getCutoffForDate(prevDate, paydays);
}

export function getNextCutoff(cutoff, paydays = [10, 25]) {
  const endDate = parseDate(cutoff.end);
  // Step 1 day after the end date
  const nextDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
  return getCutoffForDate(nextDate, paydays);
}

export function isDateInRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
}

export function formatShortRange(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);

  const startMon = start.toLocaleDateString('en-US', { month: 'short' });
  const endMon = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMon === endMon) {
    return `${startMon} ${startDay} – ${endDay}`;
  }
  return `${startMon} ${startDay} – ${endMon} ${endDay}`;
}

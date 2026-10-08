// ====================================================================
// CLOUDY BUDGET - FORMATTING UTILITIES
// ====================================================================

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  const date = new Date(year, parseInt(month, 10) - 1, 1);
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
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function parseDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr);
  const clean = String(dateStr).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length < 3) return new Date(dateStr);
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

/**
 * Returns safe cutoff period for a given date.
 * Default semi-monthly:
 * Cutoff A: Day 10 to 24 of month
 * Cutoff B: Day 25 to Day 9 of following month
 * Robust against payday order, month boundaries, leap years, and monthly pay cycles.
 */
export function getCutoffForDate(dateInput = new Date(), paydays = [10, 25], payCycle = 'semi-monthly') {
  const d = dateInput instanceof Date ? dateInput : parseDate(dateInput);
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();

  // Normalize paydays
  const rawPaydays = Array.isArray(paydays) ? paydays : [10, 25];
  const sortedPaydays = [...new Set(rawPaydays.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 31))].sort((a, b) => a - b);
  
  if (sortedPaydays.length === 0) {
    sortedPaydays.push(10, 25);
  }

  // Monthly pay cycle handling
  if (payCycle === 'monthly' || sortedPaydays.length === 1) {
    const paydayDay = sortedPaydays[0];
    let startYear = y;
    let startMonth = m;
    let nextYear = y;
    let nextMonth = m + 1;

    if (day < paydayDay) {
      // Prior cycle
      startMonth = m - 1;
      if (startMonth < 1) {
        startMonth = 12;
        startYear = y - 1;
      }
      nextYear = y;
      nextMonth = m;
    } else {
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = y + 1;
      }
    }

    const startDate = new Date(startYear, startMonth - 1, paydayDay);
    const nextPayday = new Date(nextYear, nextMonth - 1, paydayDay);
    const endDate = new Date(nextPayday.getTime() - 24 * 60 * 60 * 1000);

    const startDateStr = toDateString(startDate);
    const endDateStr = toDateString(endDate);
    const nextPaydayDate = toDateString(nextPayday);

    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const curZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let daysLeft = Math.round((endDate.getTime() - curZero.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysLeft < 1) daysLeft = 1;
    if (daysLeft > totalDays) daysLeft = totalDays;

    const id = `${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-M`;
    const label = formatShortRange(startDateStr, endDateStr);

    return {
      id,
      periodType: 'M',
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

  // Semi-monthly (2 paydays: p1, p2)
  const p1 = sortedPaydays[0];
  const p2 = sortedPaydays[1] || 25;

  let startYear, startMonth, periodType, paydayDay, nextPaydayDate;
  let startDate, nextPayday;

  if (day >= p2) {
    // Cutoff B starting on p2
    startYear = y;
    startMonth = m;
    periodType = 'B';
    paydayDay = p2;
    startDate = new Date(startYear, startMonth - 1, p2);

    const nextMDate = new Date(y, m, 1);
    const nextY = nextMDate.getFullYear();
    const nextM = nextMDate.getMonth() + 1;
    nextPayday = new Date(nextY, nextM - 1, p1);
    nextPaydayDate = toDateString(nextPayday);
  } else if (day >= p1) {
    // Cutoff A starting on p1
    startYear = y;
    startMonth = m;
    periodType = 'A';
    paydayDay = p1;
    startDate = new Date(startYear, startMonth - 1, p1);

    nextPayday = new Date(y, m - 1, p2);
    nextPaydayDate = toDateString(nextPayday);
  } else {
    // Before p1: belongs to Cutoff B of PREVIOUS month
    const prevMDate = new Date(y, m - 2, 1);
    startYear = prevMDate.getFullYear();
    startMonth = prevMDate.getMonth() + 1;
    periodType = 'B';
    paydayDay = p2;
    startDate = new Date(startYear, startMonth - 1, p2);

    nextPayday = new Date(y, m - 1, p1);
    nextPaydayDate = toDateString(nextPayday);
  }

  // End date is strictly 1 day before next payday
  const endDate = new Date(nextPayday.getTime() - 24 * 60 * 60 * 1000);
  const startDateStr = toDateString(startDate);
  const endDateStr = toDateString(endDate);

  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const curZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let daysLeft = Math.round((endDate.getTime() - curZero.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daysLeft < 1) daysLeft = 1;
  if (daysLeft > totalDays) daysLeft = totalDays;

  const id = `${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-${periodType}`;
  const label = formatShortRange(startDateStr, endDateStr);

  return {
    id,
    periodType,
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
  const prevDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  return getCutoffForDate(prevDate, paydays);
}

export function getNextCutoff(cutoff, paydays = [10, 25]) {
  const endDate = parseDate(cutoff.end);
  const nextDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
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


// ====================================================================
// LYKA WALLET - DAILY TRACKER VIEW
// Simple, straight to the point daily allowance tracker
// Widgets: Yesterday, Today, Tomorrow (with rollover from Daily Allowance envelope)
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, getTodayDateString, parseDate, toDateString, formatDate } from '../lib/format.js';
import { playPop } from '../lib/audio.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { ICONS } from '../lib/icons.js';

export function renderCalendar() {
  const container = document.createElement('div');
  container.className = 'anim-fade-in';
  container.style.padding = '1rem 1rem 7.5rem 1rem';

  const settings = store.getSettings();
  const curr = settings.currency || '₱';
  const isSemi = (settings.payCycle || 'semi-monthly') === 'semi-monthly';
  const curCutoff = store.getCurrentCutoff();
  const todayStr = getTodayDateString();
  const todayDate = parseDate(todayStr);

  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toDateString(yesterdayDate);

  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toDateString(tomorrowDate);

  const startD = parseDate(curCutoff.start);
  const endD = parseDate(curCutoff.end);
  const totalDays = Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
  const daysLeft = Math.max(1, curCutoff.daysLeft || 1);

  // Base daily allowance strictly derived from Cutoff Allowance envelope
  const cutoffCategories = store.getCutoffCategorySpending(curCutoff);
  const dailyCat = cutoffCategories.find(c => c.id === 'cat-daily' || c.name.toLowerCase().includes('allowance') || c.name.toLowerCase().includes('daily'));

  const dailyPeriodLimit = dailyCat
    ? (dailyCat.period_limit || (isSemi ? Math.round((dailyCat.monthly_limit || 0) / 2) : (dailyCat.monthly_limit || 0)))
    : 0;
  const dailySpentSoFar = dailyCat ? (dailyCat.spent || 0) : 0;
  const dailyEnvelopeRemaining = Math.max(0, dailyPeriodLimit - dailySpentSoFar);

  // Active / unpaid loans deducted from this daily allowance envelope
  const cutoffLoans = store.getTransactions().filter(t =>
    (t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))) &&
    t.loanStatus !== 'repaid' &&
    t.date >= curCutoff.start &&
    t.date <= curCutoff.end &&
    (!dailyCat || t.categoryId === dailyCat.id || t.categoryId === 'cat-daily' || !t.categoryId)
  );
  const totalLentInAllowance = cutoffLoans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const todayLoans = cutoffLoans.filter(t => t.date === todayStr);
  const todayLent = todayLoans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  let baseDaily = 0;
  let suggestedDaily = 0;
  if (dailyPeriodLimit > 0) {
    baseDaily = totalDays > 0 ? Math.round(dailyPeriodLimit / totalDays) : 0;
    suggestedDaily = daysLeft > 0 ? Math.round(dailyEnvelopeRemaining / daysLeft) : baseDaily;
  } else {
    baseDaily = 0;
    suggestedDaily = 0;
  }

  // Filter expenses belonging to Cutoff Allowance or general, excluding loans (which reduce the envelope pool)
  const txs = store.getTransactions().filter(t =>
    t.type === 'expense' &&
    !t.isLoan &&
    !(t.note && t.note.toLowerCase().includes('(hiram)')) &&
    t.date >= curCutoff.start &&
    t.date <= curCutoff.end &&
    (t.categoryId === 'cat-daily' || !t.categoryId || (dailyCat && t.categoryId === dailyCat.id))
  );

  const dailySpent = {};
  txs.forEach(t => {
    if (!dailySpent[t.date]) dailySpent[t.date] = 0;
    dailySpent[t.date] += parseFloat(t.amount) || 0;
  });

  // Calculate cumulative rollover:
  // Everyday budget is baseDaily (e.g. 2000 / 15 = 133).
  // Rollover starts from active tracking date so past days don't accumulate phantom balance.
  let trackingStartDate = todayStr;
  const cutoffRecord = store.getCutoffRecord(curCutoff.id) || {};
  if (cutoffRecord.dailyAllowanceStartDate) {
    trackingStartDate = cutoffRecord.dailyAllowanceStartDate;
  } else if (dailyPeriodLimit > 0) {
    trackingStartDate = todayStr;
    try {
      store.saveCutoffRecord({
        ...cutoffRecord,
        id: curCutoff.id,
        dailyAllowanceStartDate: todayStr,
      });
    } catch (_) {}
  }

  // If there are recorded transactions prior to trackingStartDate, adjust to the earliest transaction date
  if (txs.length > 0) {
    const earliestTx = txs.reduce((min, t) => (t.date < min ? t.date : min), txs[0].date);
    if (earliestTx < trackingStartDate) {
      trackingStartDate = earliestTx;
    }
  }

  let accumulatedLeftover = 0;
  const allDaysData = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startD);
    d.setDate(d.getDate() + i);
    const dStr = toDateString(d);
    const isPast = d < todayDate;
    const isToday = dStr === todayStr;
    const isFuture = d > todayDate;

    const isBeforeTracking = dStr < trackingStartDate;
    const spent = dailySpent[dStr] || 0;

    let startAllowance = 0;
    let leftover = 0;

    if (!isBeforeTracking && dailyPeriodLimit > 0) {
      startAllowance = baseDaily + accumulatedLeftover;
      leftover = startAllowance - spent;
    }

    allDaysData.push({
      date: d,
      dStr,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isPast,
      isToday,
      isFuture,
      spent,
      startAllowance,
      leftover,
    });

    if (!isBeforeTracking && !isFuture && dailyPeriodLimit > 0) {
      accumulatedLeftover = leftover;
    }
  }

  let todayData = allDaysData.find(d => d.dStr === todayStr);
  if (!todayData) {
    const tSpent = dailySpent[todayStr] || 0;
    const tStart = dailyPeriodLimit > 0 ? (baseDaily + accumulatedLeftover) : 0;
    todayData = {
      dStr: todayStr,
      dayNum: todayDate.getDate(),
      spent: tSpent,
      startAllowance: tStart,
      leftover: tStart - tSpent,
    };
  }

  // --- HEADER (CLEAN & DIRECT) ---
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;';
  header.innerHTML = `
    <div>
      <h2 style="font-family: var(--font-display); font-size: 1.45rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.15rem 0;">
        Daily Tracker
      </h2>
      <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
        ${curCutoff.label} &bull; ${formatCurrency(baseDaily, curr)}/day base
      </div>
    </div>
    <button id="toggle-chart-btn" class="pill squish-btn" style="cursor: pointer; border: 1px solid var(--border-color); background: var(--bg-card-cloud); color: var(--text-main); font-weight: 700; font-size: 0.8rem; padding: 0.45rem 0.85rem; border-radius: var(--radius-full);">
      View Chart
    </button>
  `;
  container.appendChild(header);

  // --- SIMPLE CHART SECTION (COLLAPSED BY DEFAULT) ---
  const chartSection = document.createElement('div');
  chartSection.id = 'chart-section';
  chartSection.className = 'cloud-card';
  chartSection.style.cssText = 'padding: 1.15rem; margin-bottom: 1.25rem; display: none; border: 1.5px solid var(--border-color);';

  const totalSpentCutoff = allDaysData.reduce((s, d) => s + d.spent, 0);
  const trackedDays = allDaysData.filter(d => !d.isFuture).length;
  const maxBarVal = Math.max(baseDaily * 1.5, ...allDaysData.map(d => d.spent), 300);

  chartSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
        Daily Spending vs Base (${formatCurrency(baseDaily, curr)}/day)
      </div>
      <button id="close-chart-btn" class="pill squish-btn" style="font-size: 0.72rem; border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-weight: 700;">
        Hide
      </button>
    </div>

    <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.75rem;">
      Spent <strong style="color: var(--text-main);">${formatCurrency(totalSpentCutoff, curr)}</strong> over ${trackedDays} days
    </div>

    <!-- Clean Bar Chart -->
    <div style="position: relative; height: 130px; background: var(--bg-card-cloud); border-radius: var(--radius-md); border: 1px solid var(--border-color); padding: 0.5rem 0.35rem; overflow-x: auto; margin-bottom: 0.75rem;">
      <!-- Base Line -->
      <div style="position: absolute; left: 0; right: 0; bottom: ${Math.round((baseDaily / maxBarVal) * 90) + 24}px; border-top: 1px dashed var(--primary); opacity: 0.6; z-index: 1; pointer-events: none;"></div>

      <div style="display: flex; gap: 0.35rem; height: 100%; min-width: ${allDaysData.length * 28}px; align-items: flex-end; padding-bottom: 20px; position: relative; z-index: 2;">
        ${allDaysData.map(d => {
          const barH = d.spent > 0 ? Math.max(6, Math.round((d.spent / maxBarVal) * 90)) : 3;
          const barColor = d.isToday ? 'var(--primary)' : (d.spent > baseDaily ? 'var(--coral-alert)' : (d.spent > 0 ? 'var(--mint-deep)' : 'rgba(0,0,0,0.06)'));
          return `
            <div class="chart-bar-col" data-date="${d.dStr}" style="height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; flex: 1; min-width: 22px; cursor: pointer;">
              <div class="chart-bar-pill" style="height: ${barH}px; width: 100%; max-width: 18px; background: ${barColor}; border-radius: 3px 3px 1px 1px; ${d.isToday ? 'box-shadow: 0 0 6px rgba(85,168,232,0.6);' : ''} ${d.isFuture ? 'opacity: 0.3;' : ''}"></div>
              <div style="position: absolute; bottom: 3px; font-size: 0.62rem; font-weight: ${d.isToday ? '800' : '600'}; color: ${d.isToday ? 'var(--primary)' : 'var(--text-muted)'}; text-align: center;">
                ${d.dayNum}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Active Selection Bubble -->
    <div id="chart-detail-box" style="font-size: 0.75rem; color: var(--text-main); font-weight: 700; text-align: center; background: rgba(0,0,0,0.03); padding: 0.4rem; border-radius: var(--radius-sm);">
      Tap any day to see its spent amount
    </div>
  `;

  // Bar click handler
  chartSection.querySelectorAll('.chart-bar-col').forEach(col => {
    col.onclick = () => {
      playPop();
      const targetDStr = col.dataset.date;
      const dObj = allDaysData.find(d => d.dStr === targetDStr);
      if (!dObj) return;
      const box = chartSection.querySelector('#chart-detail-box');
      box.innerHTML = `${formatDate(targetDStr)}${dObj.isToday ? ' (Today)' : ''}: Spent <strong style="color: var(--text-main);">${formatCurrency(dObj.spent, curr)}</strong> &bull; Net <strong style="color: ${dObj.leftover >= 0 ? 'var(--mint-deep)' : 'var(--coral-alert)'};">${dObj.leftover > 0 ? '+' : ''}${formatCurrency(dObj.leftover, curr)}</strong>`;
    };
  });

  const toggleChartBtn = header.querySelector('#toggle-chart-btn');
  const closeChartBtn = chartSection.querySelector('#close-chart-btn');
  let isChartOpen = false;

  function setChartState(open) {
    isChartOpen = open;
    chartSection.style.display = isChartOpen ? 'block' : 'none';
    toggleChartBtn.textContent = isChartOpen ? 'Close Chart' : 'View Chart';
    if (isChartOpen) {
      toggleChartBtn.style.background = 'var(--primary)';
      toggleChartBtn.style.color = '#FFF';
    } else {
      toggleChartBtn.style.background = 'var(--bg-card-cloud)';
      toggleChartBtn.style.color = 'var(--text-main)';
    }
  }

  toggleChartBtn.onclick = () => {
    playPop();
    setChartState(!isChartOpen);
  };
  closeChartBtn.onclick = () => {
    playPop();
    setChartState(false);
  };

  container.appendChild(chartSection);

  // --- WIDGETS (SUGGESTED DAILY EXPENSE, TODAY, YESTERDAY) ---
  const widgetsContainer = document.createElement('div');
  widgetsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.85rem;';

  // 1. Suggested Daily Expense Widget (Derived from Allocated Daily Allowance Budget)
  const suggestedCard = document.createElement('div');
  suggestedCard.className = 'cloud-card anim-fade-in';
  suggestedCard.style.cssText = 'padding: 1.15rem 1.25rem; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(235, 248, 255, 0.95) 0%, #FFFFFF 100%); border: 1.5px solid var(--sky-200); box-shadow: 0 4px 14px rgba(85, 168, 232, 0.1); position: relative;';

  const hasDailyBudget = dailyPeriodLimit > 0;

  suggestedCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.55rem;">
      <div style="display: flex; align-items: center; gap: 0.45rem;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius-full); background: var(--sky-100); color: var(--primary);">
          ${ICONS.wallet}
        </span>
        <div>
          <div style="font-family: var(--font-display); font-size: 0.9rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">
            Suggested Daily Expense
          </div>
        </div>
      </div>
      <span class="pill" style="font-size: 0.72rem; font-weight: 700; background: #FFF; border: 1px solid var(--border-color); color: var(--text-muted); padding: 0.18rem 0.55rem; border-radius: var(--radius-full);">
        ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left
      </span>
    </div>

    <!-- Big Suggested Number -->
    <div style="display: flex; align-items: baseline; gap: 0.4rem; margin: 0.35rem 0 0.65rem 0;">
      <span style="font-family: var(--font-display); font-size: 2.15rem; font-weight: 800; color: var(--mint-deep); line-height: 1;">
        ${formatCurrency(suggestedDaily, curr)}
      </span>
      <span style="font-size: 0.86rem; font-weight: 700; color: var(--text-muted);">
        / day
      </span>
    </div>

    <!-- Envelope Allocation Context Box -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(240, 248, 255, 0.75); padding: 0.6rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--sky-200); font-size: 0.76rem;">
      <div>
        <span style="color: var(--text-muted); font-weight: 600;">Cutoff Allowance: </span>
        <strong style="color: var(--text-main); font-weight: 800;">${hasDailyBudget ? formatCurrency(dailyPeriodLimit, curr) : 'No Budget'}</strong>
      </div>
      ${totalLentInAllowance > 0 ? `
        <div style="text-align: center;">
          <span style="color: #D97706; font-weight: 700;">🤝 Lent: </span>
          <strong style="color: #D97706; font-weight: 800;">${formatCurrency(totalLentInAllowance, curr)}</strong>
        </div>
      ` : ''}
      <div style="text-align: right;">
        <span style="color: var(--text-muted); font-weight: 600;">Envelope Left: </span>
        <strong style="color: ${hasDailyBudget ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: 800;">${hasDailyBudget ? formatCurrency(dailyEnvelopeRemaining, curr) : '₱0'}</strong>
      </div>
    </div>
    ${!hasDailyBudget ? `
      <div style="margin-top: 0.55rem; text-align: center;">
        <a href="#planner" style="font-size: 0.74rem; color: var(--primary); font-weight: 700; text-decoration: none;">
          + Allocate Cutoff Allowance in Planner &rarr;
        </a>
      </div>
    ` : ''}
  `;
  widgetsContainer.appendChild(suggestedCard);

  // 2. Today (Main Hero Card)
  const todayCard = document.createElement('div');
  todayCard.className = 'cloud-card';
  todayCard.style.cssText = 'padding: 1.25rem 1.15rem; border-radius: var(--radius-lg); border: 2px solid var(--primary); background: linear-gradient(135deg, rgba(240, 248, 255, 0.9) 0%, #FFF 100%); box-shadow: var(--shadow-sm);';

  const todayPercent = todayData.startAllowance > 0 ? Math.min(100, Math.round((todayData.spent / todayData.startAllowance) * 100)) : 0;
  const isTodayOver = todayData.leftover < 0;

  todayCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
      <div style="font-weight: 800; font-family: var(--font-display); font-size: 1.05rem; color: var(--primary);">
        Today <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">&bull; ${formatDate(todayStr)}</span>
      </div>
      <button id="today-log-btn" class="btn btn-primary squish-btn" style="padding: 0.4rem 0.8rem; font-size: 0.76rem; font-weight: 700; border-radius: var(--radius-full);">
        + Log Expense
      </button>
    </div>

    <!-- Big Key Number -->
    <div style="text-align: center; margin-bottom: 0.85rem;">
      <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Remaining To Spend</div>
      <div style="font-family: var(--font-display); font-size: 2rem; font-weight: 800; color: ${isTodayOver ? 'var(--coral-alert)' : 'var(--primary)'}; margin: 0.1rem 0;">
        ${formatCurrency(todayData.leftover, curr)}
      </div>
      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">
        Starting: ${formatCurrency(todayData.startAllowance, curr)} &bull; Spent: ${formatCurrency(todayData.spent, curr)}
      </div>
      ${todayLent > 0 ? `
        <div style="margin-top: 0.4rem; display: flex; align-items: center; justify-content: center;">
          <span class="pill" style="background: rgba(85, 168, 232, 0.12); color: var(--primary); font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); border: 1px solid var(--sky-200);">
            🤝 ${formatCurrency(todayLent, curr)} lent today &bull; Deducted from envelope
          </span>
        </div>
      ` : ''}
    </div>

    <div class="cloud-progress" style="height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
      <div class="cloud-progress-fill ${isTodayOver ? 'status-danger' : 'status-safe'}" style="width: ${todayPercent}%;"></div>
    </div>
  `;

  todayCard.querySelector('#today-log-btn').onclick = () => {
    playPop();
    openQuickAddModal('expense');
  };
  widgetsContainer.appendChild(todayCard);

  container.appendChild(widgetsContainer);
  return container;
}

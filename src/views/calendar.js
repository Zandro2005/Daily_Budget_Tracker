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
  container.style.paddingBottom = '6rem';
  container.style.padding = '1rem';

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

  // Base daily allowance strictly derived from Daily Allowance envelope
  const cutoffCategories = store.getCutoffCategorySpending(curCutoff);
  const dailyCat = cutoffCategories.find(c => c.id === 'cat-daily' || c.name.toLowerCase().includes('daily'));

  let baseDaily = 0;
  if (dailyCat && (dailyCat.period_limit > 0 || dailyCat.monthly_limit > 0)) {
    const dailyPeriodLimit = dailyCat.period_limit || (isSemi ? dailyCat.monthly_limit / 2 : dailyCat.monthly_limit);
    baseDaily = dailyPeriodLimit / totalDays;
  } else {
    const plan = isSemi ? store.getCutoffPlan(curCutoff) : store.getMonthPlan();
    baseDaily = (plan.spendBudget || 0) / totalDays;
  }

  // Filter expenses belonging to Daily Allowance or general
  const txs = store.getTransactions().filter(t =>
    t.type === 'expense' &&
    t.date >= curCutoff.start &&
    t.date <= curCutoff.end &&
    (t.categoryId === 'cat-daily' || !t.categoryId)
  );

  const dailySpent = {};
  txs.forEach(t => {
    if (!dailySpent[t.date]) dailySpent[t.date] = 0;
    dailySpent[t.date] += parseFloat(t.amount) || 0;
  });

  // Calculate cumulative rollover for all cutoff days
  let accumulatedLeftover = 0;
  const allDaysData = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startD);
    d.setDate(d.getDate() + i);
    const dStr = toDateString(d);
    const isPast = d < todayDate;
    const isToday = dStr === todayStr;
    const isFuture = d > todayDate;

    const spent = dailySpent[dStr] || 0;
    const startAllowance = baseDaily + accumulatedLeftover;
    const leftover = startAllowance - spent;

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

    if (!isFuture) {
      accumulatedLeftover = leftover;
    }
  }

  // Yesterday, Today, Tomorrow data points
  let yesterdayData = allDaysData.find(d => d.dStr === yesterdayStr);
  if (!yesterdayData) {
    const ySpent = store.getTransactions()
      .filter(t => t.type === 'expense' && t.date === yesterdayStr && (t.categoryId === 'cat-daily' || !t.categoryId))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    yesterdayData = {
      dStr: yesterdayStr,
      dayNum: yesterdayDate.getDate(),
      spent: ySpent,
      startAllowance: baseDaily,
      leftover: baseDaily - ySpent
    };
  }

  let todayData = allDaysData.find(d => d.dStr === todayStr);
  if (!todayData) {
    const tSpent = dailySpent[todayStr] || 0;
    const tStart = baseDaily + (yesterdayData ? yesterdayData.leftover : 0);
    todayData = {
      dStr: todayStr,
      dayNum: todayDate.getDate(),
      spent: tSpent,
      startAllowance: tStart,
      leftover: tStart - tSpent
    };
  }

  let tomorrowData = allDaysData.find(d => d.dStr === tomorrowStr);
  const tomorrowStart = baseDaily + todayData.leftover;
  if (!tomorrowData) {
    tomorrowData = {
      dStr: tomorrowStr,
      dayNum: tomorrowDate.getDate(),
      spent: 0,
      startAllowance: tomorrowStart,
      leftover: tomorrowStart
    };
  } else {
    tomorrowData.startAllowance = tomorrowStart;
    tomorrowData.leftover = tomorrowStart;
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

  // --- 3 CLEAN WIDGETS (YESTERDAY, TODAY, TOMORROW) ---
  const widgetsContainer = document.createElement('div');
  widgetsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.85rem;';

  // 1. Yesterday (Straight to the Point)
  const yesterdayCard = document.createElement('div');
  yesterdayCard.className = 'cloud-card';
  yesterdayCard.style.cssText = 'padding: 0.85rem 1.15rem; border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center;';
  yesterdayCard.innerHTML = `
    <div>
      <div style="font-weight: 800; font-family: var(--font-display); font-size: 0.95rem; color: var(--text-main);">
        Yesterday <span style="font-size: 0.76rem; font-weight: 600; color: var(--text-muted);">&bull; ${formatDate(yesterdayStr)}</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
        Spent: <strong style="color: var(--text-main);">${formatCurrency(yesterdayData.spent, curr)}</strong> of ${formatCurrency(yesterdayData.startAllowance, curr)}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Rolled Over</div>
      <div style="font-weight: 800; font-family: var(--font-display); font-size: 1.1rem; color: ${yesterdayData.leftover >= 0 ? 'var(--mint-deep)' : 'var(--coral-alert)'};">
        ${yesterdayData.leftover > 0 ? '+' : ''}${formatCurrency(yesterdayData.leftover, curr)}
      </div>
    </div>
  `;
  widgetsContainer.appendChild(yesterdayCard);

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

  // 3. Tomorrow (Straight to the Point)
  const tomorrowCard = document.createElement('div');
  tomorrowCard.className = 'cloud-card';
  tomorrowCard.style.cssText = 'padding: 0.85rem 1.15rem; border-radius: var(--radius-lg); display: flex; justify-content: space-between; align-items: center;';
  tomorrowCard.innerHTML = `
    <div>
      <div style="font-weight: 800; font-family: var(--font-display); font-size: 0.95rem; color: var(--text-main);">
        Tomorrow <span style="font-size: 0.76rem; font-weight: 600; color: var(--text-muted);">&bull; ${formatDate(tomorrowStr)}</span>
      </div>
      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">
        Estimated starting allowance
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Projected</div>
      <div style="font-weight: 800; font-family: var(--font-display); font-size: 1.1rem; color: var(--primary);">
        ${formatCurrency(tomorrowData.startAllowance, curr)}
      </div>
    </div>
  `;
  widgetsContainer.appendChild(tomorrowCard);

  container.appendChild(widgetsContainer);
  return container;
}

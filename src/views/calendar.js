// ====================================================================
// LYKA WALLET - DEDICATED CALENDAR VIEW
// Interactive month calendar with daily expense tracking, pay-period bands,
// payday badges, safe-spend status colors, and instant day ledger.
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, getTodayDateString, parseDate, toDateString, formatMonthName } from '../lib/format.js';
import { renderDayDetail } from '../components/dayDetail.js';
import { playPop } from '../lib/audio.js';
import { ICONS } from '../lib/icons.js';

let activeYear = new Date().getFullYear();
let activeMonth = new Date().getMonth() + 1; // 1-12
let selectedDateStr = getTodayDateString();

export function renderCalendar() {
  const container = document.createElement('div');
  container.className = 'calendar-view anim-fade-in';

  function renderView() {
    container.innerHTML = '';

    const settings = store.getSettings();
    const curr = settings.currency || '₱';
    const todayStr = getTodayDateString();

    // 1. Navigation Header (Month/Year with Chevrons and Today button)
    const headerEl = document.createElement('div');
    headerEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem;';

    const monthTitleStr = new Date(activeYear, activeMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    headerEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button id="cal-prev-month" class="icon-btn squish-btn" title="Previous Month" style="width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--bg-card-cloud); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-main);">
          ${ICONS.chevronLeft}
        </button>
        <h2 style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; margin: 0; color: var(--text-main);">
          ${monthTitleStr}
        </h2>
        <button id="cal-next-month" class="icon-btn squish-btn" title="Next Month" style="width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--bg-card-cloud); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-main);">
          ${ICONS.chevronRight}
        </button>
      </div>

      <button id="cal-jump-today" class="pill squish-btn" style="cursor: pointer; border: none; padding: 0.4rem 0.85rem; font-size: 0.8rem; font-weight: 700; background: var(--sky-100); color: var(--primary);">
        Today
      </button>
    `;

    headerEl.querySelector('#cal-prev-month').onclick = () => {
      playPop();
      if (activeMonth === 1) {
        activeMonth = 12;
        activeYear--;
      } else {
        activeMonth--;
      }
      renderView();
    };

    headerEl.querySelector('#cal-next-month').onclick = () => {
      playPop();
      if (activeMonth === 12) {
        activeMonth = 1;
        activeYear++;
      } else {
        activeMonth++;
      }
      renderView();
    };

    headerEl.querySelector('#cal-jump-today').onclick = () => {
      playPop();
      const now = new Date();
      activeYear = now.getFullYear();
      activeMonth = now.getMonth() + 1;
      selectedDateStr = todayStr;
      renderView();
    };

    container.appendChild(headerEl);

    // 2. Month Summary Metrics Pills
    const daysInMonth = new Date(activeYear, activeMonth, 0).getDate();
    let monthTotalSpent = 0;
    let noSpendCount = 0;
    let overLimitCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = store.getDayStatus(dStr);
      if (!status.isFuture) {
        monthTotalSpent += status.totalSpent;
        if (status.spent === 0 && status.billsSpent === 0) noSpendCount++;
        if (status.status === 'over') overLimitCount++;
      }
    }

    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = 'display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1rem;';
    summaryCard.innerHTML = `
      <div class="pill" style="background: var(--bg-card-cloud); border: 1px solid var(--border-color); font-size: 0.76rem; font-weight: 700; color: var(--text-main); white-space: nowrap; padding: 0.4rem 0.75rem;">
        Spent: <strong style="color: var(--primary);">${formatCurrency(monthTotalSpent, curr)}</strong>
      </div>
      <div class="pill" style="background: rgba(156, 227, 192, 0.28); border: 1px solid rgba(156, 227, 192, 0.6); font-size: 0.76rem; font-weight: 700; color: var(--mint-deep); white-space: nowrap; padding: 0.4rem 0.75rem;">
        ✨ ${noSpendCount} no-spend days
      </div>
      ${overLimitCount > 0 ? `
        <div class="pill" style="background: rgba(255, 123, 137, 0.18); border: 1px solid rgba(255, 123, 137, 0.5); font-size: 0.76rem; font-weight: 700; color: var(--danger); white-space: nowrap; padding: 0.4rem 0.75rem;">
          ⚠️ ${overLimitCount} over limit
        </div>
      ` : ''}
    `;
    container.appendChild(summaryCard);

    // 3. Calendar Grid Card
    const calCard = document.createElement('div');
    calCard.className = 'cloud-card';
    calCard.style.cssText = 'padding: 1rem 0.5rem; margin-bottom: 1.5rem; border-radius: var(--radius-lg);';

    // Weekday headers: Mon Tue Wed Thu Fri Sat Sun
    const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const firstDayDate = new Date(activeYear, activeMonth - 1, 1);
    // getDay(): 0 is Sunday, 1 is Monday...
    const firstDayOfWeek = (firstDayDate.getDay() + 6) % 7; // 0 for Mon, 6 for Sun

    let gridHtml = `
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.74rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.65rem;">
        ${weekdays.map(w => `<div>${w}</div>`).join('')}
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; row-gap: 6px;">
    `;

    // Blanks before day 1
    for (let b = 0; b < firstDayOfWeek; b++) {
      gridHtml += `<div style="min-height: 52px;"></div>`;
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = store.getDayStatus(dStr);
      const isSelected = dStr === selectedDateStr;
      const isToday = dStr === todayStr;

      // Period tint band
      // Period A: 10th to 24th -> faint sky
      // Period B: 25th to 9th -> faint blush
      const isPeriodA = status.periodType === 'A';
      const isPeriodB = status.periodType === 'B';
      const bandBg = isPeriodA ? 'rgba(206, 231, 248, 0.28)' : 'rgba(255, 183, 210, 0.18)';

      // Status indicator circle background
      let numBg = 'transparent';
      let numColor = 'var(--text-main)';
      let numBorder = '1.5px solid transparent';

      if (!status.isFuture) {
        if (status.status === 'under' || status.status === 'zero') {
          numBg = 'rgba(156, 227, 192, 0.45)';
          numColor = 'var(--mint-deep)';
        } else if (status.status === 'close') {
          numBg = 'rgba(255, 210, 157, 0.45)';
          numColor = '#C67A10';
        } else if (status.status === 'over') {
          numBg = 'rgba(255, 123, 137, 0.4)';
          numColor = 'var(--danger)';
        }
      }

      if (isToday) {
        numBorder = '2px dashed var(--primary)';
      }

      if (isSelected) {
        numBg = 'var(--primary)';
        numColor = '#FFF';
        numBorder = '2px solid var(--primary)';
      }

      // Compact amount format: e.g. ₱320, ₱1.4k
      let amountLabel = '';
      if (!status.isFuture && status.totalSpent > 0) {
        if (status.totalSpent >= 1000) {
          amountLabel = `₱${(status.totalSpent / 1000).toFixed(1)}k`;
        } else {
          amountLabel = `₱${Math.round(status.totalSpent)}`;
        }
      }

      gridHtml += `
        <button 
          class="cal-cell-btn squish-btn" 
          data-date="${dStr}" 
          style="
            background: ${bandBg}; 
            border: none; 
            border-radius: var(--radius-sm); 
            padding: 0.25rem 0.1rem; 
            cursor: pointer; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: flex-start; 
            min-height: 52px; 
            position: relative;
            outline: none;
            transition: all 0.15s ease;
          "
        >
          <!-- Payday Coin Badge at top right of cell -->
          ${status.isPayday ? `
            <div style="position: absolute; top: 1px; right: 2px; width: 14px; height: 14px; z-index: 2;" title="Payday 💰">
              ${ICONS.coin}
            </div>
          ` : ''}

          <!-- Day number badge -->
          <div style="
            width: 28px; 
            height: 28px; 
            border-radius: var(--radius-full); 
            background: ${numBg}; 
            color: ${numColor}; 
            border: ${numBorder};
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-family: var(--font-display); 
            font-size: 0.95rem; 
            font-weight: 800;
            margin-bottom: 2px;
          ">
            ${day}
          </div>

          <!-- Spent amount beneath -->
          <div style="
            font-size: 0.65rem; 
            font-weight: 700; 
            color: ${status.status === 'over' ? 'var(--coral-alert)' : 'var(--text-muted)'};
            ${status.status === 'over' ? 'border-bottom: 1.5px dashed var(--coral-alert);' : ''}
            line-height: 1;
            height: 12px;
          ">
            ${amountLabel}
          </div>
        </button>
      `;
    }

    gridHtml += `</div>`;
    calCard.innerHTML = gridHtml;

    // Attach click events to cells
    calCard.querySelectorAll('.cal-cell-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        selectedDateStr = btn.dataset.date;
        renderView();
      };
    });

    container.appendChild(calCard);

    // 4. Day Details Section
    const dayDetailContainer = document.createElement('div');
    dayDetailContainer.id = 'calendar-day-detail-slot';
    const dayDetailEl = renderDayDetail(selectedDateStr, () => {
      renderView();
    });
    dayDetailContainer.appendChild(dayDetailEl);
    container.appendChild(dayDetailContainer);
  }

  renderView();
  return container;
}

// ====================================================================
// LYKA WALLET - WEEK STRIP COMPONENT (Home Screen)
// Clean horizontal week calendar with day dots, payday badges, and modal detail
// ====================================================================

import { store } from '../lib/store.js';
import { getTodayDateString, parseDate, toDateString } from '../lib/format.js';
import { renderDayDetail } from './dayDetail.js';
import { playPop } from '../lib/audio.js';
import { ICONS } from '../lib/icons.js';

export function renderWeekStrip() {
  const container = document.createElement('div');
  container.className = 'week-strip-wrapper';
  container.style.cssText = 'margin-bottom: 1.25rem;';

  const todayStr = getTodayDateString();
  const today = parseDate(todayStr);

  // Compute start of current week (Monday)
  // getDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const dayOfWeek = today.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7; // 0 if Mon, 6 if Sun
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - distanceToMonday);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push({
      dateStr: toDateString(d),
      dayNum: d.getDate(),
      dayLetter: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
      dateObj: d,
    });
  }

  const currentMonthName = today.toLocaleDateString('en-US', { month: 'long' });

  container.innerHTML = `
    <!-- Header with Month & Calendar Link -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; padding: 0 0.25rem;">
      <span style="font-size: 0.76rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
        This Week
      </span>
      <button id="week-open-calendar" class="pill squish-btn" style="cursor: pointer; border: none; padding: 0.25rem 0.65rem; font-size: 0.76rem; display: flex; align-items: center; gap: 0.35rem; background: var(--bg-card-cloud); border: 1px solid var(--border-color); color: var(--text-main); font-weight: 700;">
        <span>${currentMonthName}</span>
        <span style="display: inline-flex; width: 14px; height: 14px; color: var(--primary);">${ICONS.calendarDays}</span>
      </button>
    </div>

    <!-- 7 Day Strip Container -->
    <div class="week-strip-container" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; background: var(--bg-card-cloud); padding: 0.75rem 0.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); text-align: center;">
      ${days.map(d => {
        const status = store.getDayStatus(d.dateStr);
        const isToday = d.dateStr === todayStr;

        let dotColor = 'transparent';
        if (!status.isFuture) {
          if (status.status === 'under' || status.status === 'zero') dotColor = 'var(--mint-deep)';
          else if (status.status === 'close') dotColor = 'var(--peach-orange)';
          else if (status.status === 'over') dotColor = 'var(--coral-alert)';
        }

        return `
          <button class="week-day-cell squish-btn ${isToday ? 'today' : ''}" data-date="${d.dateStr}" style="background: ${isToday ? 'linear-gradient(135deg, var(--sky-100) 0%, #FFF 100%)' : 'transparent'}; border: ${isToday ? '2px solid var(--primary)' : '1px solid transparent'}; border-radius: var(--radius-md); padding: 0.45rem 0.2rem; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; position: relative; transition: all 0.15s ease;">
            <!-- Weekday letter -->
            <span style="font-size: 0.7rem; font-weight: 700; color: ${isToday ? 'var(--primary)' : 'var(--text-muted)'};">
              ${d.dayLetter}
            </span>

            <!-- Day number circle -->
            <span style="font-family: var(--font-display); font-size: 1.05rem; font-weight: 800; color: ${isToday ? 'var(--primary)' : 'var(--text-main)'};">
              ${d.dayNum}
            </span>

            <!-- Bottom status dot or coin badge -->
            <div style="height: 12px; display: flex; align-items: center; justify-content: center;">
              ${status.isPayday ? `
                <span title="Payday" style="display: inline-flex; width: 13px; height: 13px;">${ICONS.coin}</span>
              ` : `
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: ${dotColor};"></span>
              `}
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  // Attach Month shortcut to calendar hash
  container.querySelector('#week-open-calendar').onclick = () => {
    playPop();
    window.location.hash = '#calendar';
  };

  // Attach click on day cells to open Day Detail Modal
  container.querySelectorAll('.week-day-cell').forEach(btn => {
    btn.onclick = () => {
      playPop();
      const date = btn.dataset.date;
      openDayDetailModal(date);
    };
  });

  return container;
}

function openDayDetailModal(dateStr) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop day-detail-backdrop open';

  const modalDialog = document.createElement('div');
  modalDialog.className = 'modal-dialog';
  modalDialog.style.maxWidth = '420px';

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 250);
  };

  const dayDetailEl = renderDayDetail(dateStr, () => {
    // If updated, keep updated
  }, close);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position: absolute; top: 1rem; right: 1rem; z-index: 10;';

  closeBtn.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  modalDialog.appendChild(closeBtn);
  modalDialog.appendChild(dayDetailEl);
  backdrop.appendChild(modalDialog);
  document.body.appendChild(backdrop);
}

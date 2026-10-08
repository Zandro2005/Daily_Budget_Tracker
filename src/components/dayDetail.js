// ====================================================================
// LYKA WALLET - DAY DETAIL COMPONENT
// Beautiful breakdown of spending on a selected calendar day
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, getTodayDateString, parseDate, escapeHtml } from '../lib/format.js';
import { openQuickAddModal } from './quickAddModal.js';
import { playPop } from '../lib/audio.js';
import { showToast } from './toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderDayDetail(dateStr = getTodayDateString(), onUpdated = null, onCloseModal = null) {
  const container = document.createElement('div');
  container.className = 'day-detail-card cloud-card anim-fade-in';
  container.style.cssText = 'padding: 1.25rem; border-radius: var(--radius-lg);';

  function update() {
    container.innerHTML = '';

    const settings = store.getSettings();
    const curr = settings.currency || '₱';
    const dayStatus = store.getDayStatus(dateStr);
    const dateObj = parseDate(dateStr);
    const todayStr = getTodayDateString();

    const isToday = dateStr === todayStr;
    const dayTitle = isToday
      ? `Today &bull; ${dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      : dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Status pill text and colors
    let statusPillHtml = '';
    const diff = Math.abs(dayStatus.limit - dayStatus.spent);

    if (dayStatus.isFuture) {
      statusPillHtml = `<span class="pill" style="background: var(--sky-100); color: var(--text-muted); font-size: 0.74rem;">Upcoming day</span>`;
    } else if (dayStatus.spent === 0 && dayStatus.billsSpent === 0) {
      statusPillHtml = `<span class="pill" style="background: rgba(156, 227, 192, 0.28); color: var(--mint-deep); font-size: 0.74rem; font-weight: 700;">✨ No-spend day!</span>`;
    } else if (dayStatus.status === 'under') {
      statusPillHtml = `<span class="pill" style="background: rgba(156, 227, 192, 0.28); color: var(--mint-deep); font-size: 0.74rem; font-weight: 700;">${formatCurrency(diff, curr)} under daily limit</span>`;
    } else if (dayStatus.status === 'close') {
      statusPillHtml = `<span class="pill" style="background: rgba(255, 210, 157, 0.35); color: #C67A10; font-size: 0.74rem; font-weight: 700;">Near daily limit (${formatCurrency(diff, curr)} left)</span>`;
    } else {
      statusPillHtml = `<span class="pill" style="background: rgba(255, 123, 137, 0.22); color: var(--danger); font-size: 0.74rem; font-weight: 700;">+${formatCurrency(diff, curr)} over daily limit</span>`;
    }

    const percent = dayStatus.limit > 0 ? Math.min(100, Math.round((dayStatus.spent / dayStatus.limit) * 100)) : 0;
    const progressClass = dayStatus.status === 'over' ? 'status-danger' : dayStatus.status === 'close' ? 'status-warn' : 'status-safe';

    // Transactions for this day (both income and expenses)
    const dayTxs = store.getTransactions().filter(t => t.date === dateStr);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">
            ${dayTitle}
          </div>
          <div style="font-family: var(--font-display); font-size: 1.65rem; font-weight: 700; color: var(--text-main); margin: 0.2rem 0;">
            ${formatCurrency(dayStatus.totalSpent, curr)} <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);">spent</span>
          </div>
        </div>
        <div>
          ${statusPillHtml}
        </div>
      </div>

      <!-- Progress vs Daily Safe Spending -->
      <div style="margin-bottom: 1.15rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.35rem;">
          <span>Daily Allowance Target</span>
          <span>${formatCurrency(dayStatus.limit, curr)} / day</span>
        </div>
        <div class="cloud-progress" style="height: 8px;">
          <div class="cloud-progress-fill ${progressClass}" style="width: ${percent}%;"></div>
        </div>
      </div>

      <!-- Transaction List for Selected Day -->
      <div style="margin-bottom: 1.15rem;">
        <div style="font-size: 0.78rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.55rem; letter-spacing: 0.05em;">
          Entries (${dayTxs.length})
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.55rem;">
          ${dayTxs.length === 0 ? `
            <div style="text-align: center; padding: 1.25rem; background: var(--bg-card-cloud); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
              <span style="font-size: 0.84rem; color: var(--text-muted);">No records logged for this day</span>
            </div>
          ` : dayTxs.map(t => {
            const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.8rem; background: var(--bg-card-cloud); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
                  <div style="width: 34px; height: 34px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                    ${getCategoryIconSvg(t.categoryId || t.categoryName)}
                  </div>
                  <div style="min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(t.note || t.categoryName)}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
                      <span>${escapeHtml(t.categoryName)}</span>
                      ${isBill ? '<span class="pill" style="padding: 0.05rem 0.35rem; font-size: 0.65rem; background: #E6F0FA; color: var(--primary);">Bill ⚡</span>' : ''}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <span style="font-family: var(--font-display); font-weight: 800; font-size: 0.96rem; color: ${t.type === 'income' ? 'var(--mint-deep)' : 'var(--text-main)'};">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, curr)}
                  </span>
                  <button class="icon-btn day-tx-edit-btn" data-id="${t.id}" title="Edit" style="width: 26px; height: 26px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    ${ICONS.edit}
                  </button>
                  <button class="icon-btn day-tx-del-btn" data-id="${t.id}" title="Delete" style="width: 26px; height: 26px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    ${ICONS.trash}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Action: Add Expense for this day -->
      <button id="day-add-expense-btn" class="btn squish-btn" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--sky-400) 0%, var(--sky-600) 100%); color: #FFF; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem; border: none; box-shadow: var(--shadow-sm);">
        ${ICONS.plusCircle} Add Expense for this day
      </button>
    `;

    // Hook edit buttons
    container.querySelectorAll('.day-tx-edit-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const tx = store.getTransactions().find(t => t.id === id);
        if (tx) {
          if (typeof onCloseModal === 'function') {
            onCloseModal();
          } else {
            const parentBackdrop = btn.closest('.modal-backdrop, .day-detail-backdrop');
            if (parentBackdrop) {
              parentBackdrop.classList.remove('open');
              parentBackdrop.remove();
            }
          }
          openQuickAddModal(tx.type, { editTx: tx });
        }
      };
    });

    // Hook delete buttons
    container.querySelectorAll('.day-tx-del-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const deleted = store.deleteTransaction(id);
        if (deleted) {
          showToast({
            text: 'Transaction removed',
            onUndo: () => {
              store.addTransaction(deleted);
              update();
              if (onUpdated) onUpdated();
            },
          });
          update();
          if (onUpdated) onUpdated();
        }
      };
    });

    // Hook Add button with preset date
    const addBtn = container.querySelector('#day-add-expense-btn');
    if (addBtn) {
      addBtn.onclick = () => {
        playPop();
        if (typeof onCloseModal === 'function') {
          onCloseModal();
        } else {
          const parentBackdrop = addBtn.closest('.modal-backdrop, .day-detail-backdrop');
          if (parentBackdrop) {
            parentBackdrop.classList.remove('open');
            parentBackdrop.remove();
          }
        }
        openQuickAddModal('expense', { date: dateStr });
      };
    }
  }

  update();
  return container;
}

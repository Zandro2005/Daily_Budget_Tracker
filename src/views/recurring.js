// ====================================================================
// CLOUDY BUDGET - RECURRING BILLS & SUBSCRIPTIONS VIEW
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, getTodayDateString, escapeHtml } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderRecurring() {
  const container = document.createElement('div');
  container.className = 'recurring-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const recurringList = store.getRecurring();

    const totalCommitted = recurringList.reduce((acc, r) => acc + (r.isActive ? r.amount : 0), 0);

    // Header & Add Bill Button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;';
    header.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
          ${ICONS.repeat} Recurring Bills & Subscriptions
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin: 0.2rem 0 0 0;">
          Keep track of rent, internet, subscriptions, and fixed dues
        </p>
      </div>
      <button class="btn btn-primary squish-btn" id="open-new-bill-btn" style="display: flex; align-items: center; gap: 0.35rem;">
        ${ICONS.plusCircle} Add Subscription
      </button>
    `;

    header.querySelector('#open-new-bill-btn').onclick = () => {
      playPop();
      openBillModal();
    };
    container.appendChild(header);

    // Summary Card
    const summaryCard = document.createElement('div');
    summaryCard.className = 'cloud-card';
    summaryCard.style.marginBottom = '1.5rem';
    summaryCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Monthly Committed Expenses
          </span>
          <div style="font-family: var(--font-display); font-size: 2rem; font-weight: 700; color: var(--text-main);">
            ${formatCurrency(totalCommitted, curr)}
          </div>
        </div>
        <div class="pill" style="padding: 0.5rem 1rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem;">
          ${ICONS.calendar} ${recurringList.length} Active Subscriptions
        </div>
      </div>
    `;
    container.appendChild(summaryCard);

    // List of Bills
    const listWrapper = document.createElement('div');
    listWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem;';

    if (recurringList.length === 0) {
      listWrapper.innerHTML = `
        <div class="cloud-card" style="text-align: center; padding: 3rem 1rem;">
          <div style="width: 48px; height: 48px; margin: 0 auto 0.75rem auto; color: var(--text-muted);">${ICONS.repeat}</div>
          <h3 style="font-family: var(--font-display); font-size: 1.25rem;">No recurring bills added yet</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0.25rem;">Add your subscriptions to never miss a due date!</p>
        </div>
      `;
    } else {
      // Sort: unpaid subscriptions first
      const sortedList = [...recurringList].sort((a, b) => {
        const aPaid = store.isRecurringPaidThisMonth(a);
        const bPaid = store.isRecurringPaidThisMonth(b);
        if (aPaid !== bPaid) return aPaid ? 1 : -1;
        return new Date(a.nextDue || 0) - new Date(b.nextDue || 0);
      });

      sortedList.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'cloud-card';
        itemCard.style.padding = '1rem 1.25rem';
        itemCard.style.display = 'flex';
        itemCard.style.alignItems = 'center';
        itemCard.style.justifyContent = 'space-between';
        itemCard.style.flexWrap = 'wrap';
        itemCard.style.gap = '0.75rem';

        const category = store.getCategories().find(c => c.id === item.categoryId);
        const isPaid = store.isRecurringPaidThisMonth(item);

        itemCard.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary);">
              ${getCategoryIconSvg(item.categoryId || (category ? category.name : 'bills'))}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main);">${escapeHtml(item.name)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
                ${isPaid ? 'Next Due' : 'Due'}: <strong>${formatDate(item.nextDue)}</strong> &bull; ${escapeHtml(item.frequency)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="text-align: right;">
              <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.2rem;">${formatCurrency(item.amount, curr)}</span>
            </div>
            ${isPaid ? `
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span class="bill-pill bill-pill-paid">${ICONS.check} Paid this month</span>
                <button class="bill-pill-undo undo-paid-btn" data-id="${item.id}" title="Reset to unpaid">Undo</button>
              </div>
            ` : `
              <button class="bill-pill bill-pill-btn squish-btn mark-paid-btn" data-id="${item.id}">
                Pay & Log
              </button>
            `}
            <button class="icon-btn delete-bill-btn" data-id="${item.id}" title="Delete" style="width: 32px; height: 32px; color: var(--danger); display: flex; align-items: center; justify-content: center;">
              ${ICONS.trash}
            </button>
          </div>
        `;

        const markBtn = itemCard.querySelector('.mark-paid-btn');
        if (markBtn) {
          markBtn.onclick = () => {
            playCoin();
            store.markRecurringPaid(item.id);
            showToast({ text: `Paid & logged ${item.name}`, icon: 'check' });
            renderContent();
          };
        }

        const undoBtn = itemCard.querySelector('.undo-paid-btn');
        if (undoBtn) {
          undoBtn.onclick = () => {
            store.unmarkRecurringPaid(item.id);
            showToast({ text: `Reset ${item.name} to unpaid` });
            renderContent();
          };
        }

        itemCard.querySelector('.delete-bill-btn').onclick = () => {
          if (confirm(`Remove subscription "${item.name}"?`)) {
            store.deleteRecurring(item.id);
            showToast({ text: 'Subscription removed' });
            renderContent();
          }
        };

        listWrapper.appendChild(itemCard);
      });
    }

    container.appendChild(listWrapper);
  }

  function openBillModal() {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop open';
    const categories = store.getCategories();

    modalBackdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">New Subscription</h3>
          <button class="modal-close" id="bill-modal-close">&times;</button>
        </div>
        <form id="bill-form">
          <div class="form-group">
            <label class="form-label">Subscription Name</label>
            <input type="text" id="bill-name" class="form-input" required placeholder="e.g. Netflix, Fiber WiFi, Gym, Rent">
          </div>
          <div class="form-group">
            <label class="form-label">Amount (${store.getSettings().currency})</label>
            <input type="number" id="bill-amount" class="form-input" required step="any" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="bill-cat" class="form-select">
              ${categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Next Due Date</label>
            <input type="date" id="bill-date" class="form-input" value="${getTodayDateString()}">
          </div>
          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; margin-top: 1rem; padding: 0.85rem;">
            Save Subscription
          </button>
        </form>
      </div>
    `;

    const close = () => {
      modalBackdrop.classList.remove('open');
      setTimeout(() => modalBackdrop.remove(), 250);
    };

    modalBackdrop.querySelector('#bill-modal-close').onclick = close;
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) close();
    });

    modalBackdrop.querySelector('#bill-form').onsubmit = (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#bill-name').value;
      const amount = parseFloat(modalBackdrop.querySelector('#bill-amount').value);
      const categoryId = modalBackdrop.querySelector('#bill-cat').value;
      const nextDue = modalBackdrop.querySelector('#bill-date').value;

      if (!amount || amount <= 0) return;

      store.addRecurring({
        name,
        amount,
        categoryId,
        nextDue,
      });

      playCoin();
      showToast({ text: 'Subscription saved', icon: 'check' });
      close();
      renderContent();
    };

    document.body.appendChild(modalBackdrop);
  }

  renderContent();
  return container;
}

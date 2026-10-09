// ====================================================================
// CLOUDY BUDGET - TRANSACTIONS VIEW
// Full ledger with search, filtering, CSV export, and record management
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, stripEmojis, escapeHtml } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderTransactions() {
  const container = document.createElement('div');
  container.className = 'transactions-view anim-fade-in';

  let currentFilter = {
    search: '',
    type: 'all',
    categoryId: 'all',
  };

  function updateView() {
    container.innerHTML = '';

    const settings = store.getSettings();
    const curr = settings.currency;
    const categories = store.getCategories();
    const txList = store.getTransactions(currentFilter);

    // Header & Actions
    const topBar = document.createElement('div');
    topBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.5rem;';
    topBar.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.45rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
          ${ICONS.history} History
        </h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin: 0.2rem 0 0 0;">
          All your logged expenses and income records
        </p>
      </div>
      <div style="display: flex; align-items: center; gap: 0.4rem;">
        <button class="pill squish-btn" id="tx-add-expense" style="cursor: pointer; border: none; padding: 0.45rem 0.75rem; font-size: 0.76rem; background: var(--coral-soft); color: var(--coral-deep); font-weight: 700;">
          + Expense
        </button>
        <button class="pill squish-btn" id="tx-add-income" style="cursor: pointer; border: none; padding: 0.45rem 0.75rem; font-size: 0.76rem; background: var(--mint-soft); color: var(--mint-deep); font-weight: 700;">
          + Income
        </button>
        <button class="pill squish-btn" id="export-csv-btn" style="cursor: pointer; border: none; padding: 0.45rem 0.75rem; font-size: 0.76rem; display: flex; align-items: center; gap: 0.35rem;">
          ${ICONS.download} CSV
        </button>
      </div>
    `;

    topBar.querySelector('#tx-add-expense').onclick = () => {
      playPop();
      openQuickAddModal('expense');
    };
    topBar.querySelector('#tx-add-income').onclick = () => {
      playPop();
      openQuickAddModal('income');
    };
    topBar.querySelector('#export-csv-btn').onclick = () => {
      playPop();
      store.exportCSV();
      showToast({ text: 'CSV export downloaded!', icon: 'check' });
    };

    container.appendChild(topBar);

    // Search & Filter Controls Card
    const filterCard = document.createElement('div');
    filterCard.className = 'cloud-card';
    filterCard.style.padding = '1rem';
    filterCard.style.marginBottom = '1.5rem';

    filterCard.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem;">
        <input 
          type="text" 
          id="tx-search-input" 
          class="form-input" 
          placeholder="Search notes or categories..."
          value="${currentFilter.search}"
        >
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <!-- Type Filter -->
          <select id="tx-type-filter" class="form-select" style="flex: 1; min-width: 120px;">
            <option value="all" ${currentFilter.type === 'all' ? 'selected' : ''}>All Types</option>
            <option value="expense" ${currentFilter.type === 'expense' ? 'selected' : ''}>Expenses Only</option>
            <option value="income" ${currentFilter.type === 'income' ? 'selected' : ''}>Income Only</option>
          </select>

          <!-- Category Filter -->
          <select id="tx-cat-filter" class="form-select" style="flex: 1.5; min-width: 150px;">
            <option value="all" ${currentFilter.categoryId === 'all' ? 'selected' : ''}>All Categories</option>
            ${categories.map(c => `
              <option value="${escapeHtml(c.id)}" ${currentFilter.categoryId === c.id ? 'selected' : ''}>
                ${escapeHtml(c.name)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
    `;

    const searchInput = filterCard.querySelector('#tx-search-input');
    searchInput.oninput = (e) => {
      currentFilter.search = e.target.value;
      renderListOnly();
    };

    const typeSelect = filterCard.querySelector('#tx-type-filter');
    typeSelect.onchange = (e) => {
      playPop();
      currentFilter.type = e.target.value;
      renderListOnly();
    };

    const catSelect = filterCard.querySelector('#tx-cat-filter');
    catSelect.onchange = (e) => {
      playPop();
      currentFilter.categoryId = e.target.value;
      renderListOnly();
    };

    container.appendChild(filterCard);

    // List Container
    const listWrapper = document.createElement('div');
    listWrapper.id = 'tx-list-wrapper';
    container.appendChild(listWrapper);

    renderListOnly();
  }

  function renderListOnly() {
    const listWrapper = container.querySelector('#tx-list-wrapper');
    if (!listWrapper) return;

    const settings = store.getSettings();
    const curr = settings.currency;
    const txList = store.getTransactions(currentFilter);

    if (txList.length === 0) {
      listWrapper.innerHTML = `
        <div class="cloud-card" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="width: 48px; height: 48px; margin: 0 auto 0.75rem auto; color: var(--text-muted);">${ICONS.history}</div>
          <h3 style="font-family: var(--font-display); font-size: 1.25rem;">No matching transactions found</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0.25rem;">Try adjusting your search or add a new record!</p>
        </div>
      `;
      return;
    }

    // Compute total for filtered records
    const totalAmount = txList.reduce((acc, t) => t.type === 'expense' ? acc - t.amount : acc + t.amount, 0);

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; padding: 0 0.5rem; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
        <span>Showing ${txList.length} items</span>
        <span>Net: <strong style="color: ${totalAmount >= 0 ? 'var(--mint-deep)' : 'var(--coral-alert)'}">${formatCurrency(totalAmount, curr)}</strong></span>
      </div>
      <div class="cloud-card" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
    `;

    txList.forEach(t => {
      html += `
        <div class="tx-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: var(--radius-md); background: var(--bg-card-cloud); border: 1px solid var(--border-color); gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
              ${getCategoryIconSvg(t.categoryId || t.categoryName)}
            </div>
            <div style="min-width: 0;">
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(stripEmojis(t.note) || stripEmojis(t.categoryName))}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.15rem;">
                <span>${formatDate(t.date)}</span> &bull; 
                <span class="pill" style="padding: 0.1rem 0.5rem; font-size: 0.7rem;">${escapeHtml(stripEmojis(t.categoryName))}</span>
                ${(t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))) ? `
                  <span class="pill" style="padding: 0.08rem 0.45rem; font-size: 0.68rem; font-weight: 800; background: ${t.loanStatus === 'repaid' ? 'rgba(86,193,144,0.15)' : 'rgba(255,171,0,0.15)'}; color: ${t.loanStatus === 'repaid' ? 'var(--mint-deep)' : '#B37400'}; border: 1px solid ${t.loanStatus === 'repaid' ? 'rgba(86,193,144,0.4)' : 'rgba(255,171,0,0.4)'};">
                    ${t.loanStatus === 'repaid' ? '✓ Repaid' : '🤝 Hiram'}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
            ${((t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))) && t.loanStatus !== 'repaid' && t.type === 'expense') ? `
              <button class="btn btn-sm squish-btn tx-repay-btn" data-id="${t.id}" title="Mark Paid Back" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; font-weight: 800; border-radius: var(--radius-full); background: rgba(86, 193, 144, 0.15); color: var(--mint-deep); border: 1.5px solid var(--mint-deep); cursor: pointer; white-space: nowrap;">
                Mark Paid
              </button>
            ` : ''}
            <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.05rem; color: ${
              t.type === 'income' ? 'var(--mint-deep)' : 'var(--coral-alert)'
            };">
              ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, curr)}
            </span>
            <button class="icon-btn tx-edit-btn" data-id="${t.id}" title="Edit record" style="width: 32px; height: 32px; color: var(--text-muted); display: flex; align-items: center; justify-content: center;">
              ${ICONS.edit}
            </button>
            <button class="icon-btn tx-delete-btn" data-id="${t.id}" title="Delete record" style="width: 32px; height: 32px; color: var(--danger); display: flex; align-items: center; justify-content: center;">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    listWrapper.innerHTML = html;

    listWrapper.querySelectorAll('.tx-repay-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const res = store.repayLoan(id);
        if (res) {
          playCoin();
          firePastelConfetti();
          showToast({
            text: `${res.originalTx.borrowerName || 'Borrower'} paid back ${formatCurrency(res.originalTx.amount, curr)}! Returned to envelope.`,
            icon: 'check',
          });
          renderListOnly();
        }
      };
    });

    listWrapper.querySelectorAll('.tx-edit-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const tx = store.getTransactions().find(t => t.id === id);
        if (tx) {
          openQuickAddModal(tx.type, { editTx: tx });
        }
      };
    });

    listWrapper.querySelectorAll('.tx-delete-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const deleted = store.deleteTransaction(id);
        if (deleted) {
          showToast({
            text: 'Transaction deleted',
            onUndo: () => {
              store.addTransaction(deleted);
              showToast({ text: 'Transaction restored' });
            },
          });
          renderListOnly();
        }
      };
    });
  }

  updateView();
  return container;
}

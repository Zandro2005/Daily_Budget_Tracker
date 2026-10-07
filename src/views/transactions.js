// ====================================================================
// CLOUDY BUDGET - TRANSACTIONS VIEW
// Full ledger with search, filtering, CSV export, and record management
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { showToast } from '../components/toast.js';

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
    topBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem;';
    topBar.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.45rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          <span>📋</span> History
        </h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
          All your logged treats & income
        </p>
      </div>
      <button class="pill squish-btn" id="export-csv-btn" style="cursor: pointer; border: none; padding: 0.45rem 0.85rem; font-size: 0.78rem;">
        <span>📥</span> Export CSV
      </button>
    `;

    topBar.querySelector('#export-csv-btn').onclick = () => {
      playPop();
      store.exportCSV();
      showToast({ text: 'CSV export downloaded! 📁', icon: '✨' });
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
          placeholder="🔍 Search notes or categories..."
          value="${currentFilter.search}"
        >
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <!-- Type Filter -->
          <select id="tx-type-filter" class="form-select" style="flex: 1; min-width: 120px;">
            <option value="all" ${currentFilter.type === 'all' ? 'selected' : ''}>All Types</option>
            <option value="expense" ${currentFilter.type === 'expense' ? 'selected' : ''}>💸 Expenses Only</option>
            <option value="income" ${currentFilter.type === 'income' ? 'selected' : ''}>💰 Income Only</option>
          </select>

          <!-- Category Filter -->
          <select id="tx-cat-filter" class="form-select" style="flex: 1.5; min-width: 150px;">
            <option value="all" ${currentFilter.categoryId === 'all' ? 'selected' : ''}>All Categories</option>
            ${categories.map(c => `
              <option value="${c.id}" ${currentFilter.categoryId === c.id ? 'selected' : ''}>
                ${c.emoji} ${c.name}
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
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">☁️</div>
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
            <div style="width: 42px; height: 42px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
              ${t.categoryEmoji || '🏷️'}
            </div>
            <div style="min-width: 0;">
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${t.note || t.categoryName}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">
                ${formatDate(t.date)} &bull; <span class="pill" style="padding: 0.1rem 0.5rem; font-size: 0.7rem;">${t.categoryName}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.85rem; flex-shrink: 0;">
            <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.05rem; color: ${
              t.type === 'income' ? 'var(--mint-deep)' : 'var(--coral-alert)'
            };">
              ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, curr)}
            </span>
            <button class="icon-btn tx-delete-btn" data-id="${t.id}" title="Delete record" style="width: 32px; height: 32px; font-size: 0.85rem; color: var(--danger);">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    listWrapper.innerHTML = html;

    listWrapper.querySelectorAll('.tx-delete-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const id = btn.dataset.id;
        const deleted = store.deleteTransaction(id);
        if (deleted) {
          showToast({
            text: 'Transaction deleted! 🗑️',
            icon: '🐾',
            onUndo: () => {
              store.addTransaction(deleted);
              showToast({ text: 'Restored! ✨' });
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

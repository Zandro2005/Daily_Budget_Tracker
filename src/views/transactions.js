// ====================================================================
// CLOUDY BUDGET - TRANSACTIONS VIEW
// Full ledger with cutoff selector, search, sorting, CSV export,
// and 10-per-page Load More pagination to prevent endless scrolling
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, stripEmojis, escapeHtml, isDateInRange } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderTransactions() {
  const container = document.createElement('div');
  container.className = 'transactions-view anim-fade-in';

  const PAGE_SIZE = 10;
  let visibleLimit = PAGE_SIZE;

  let currentFilter = {
    search: '',
    period: 'current', // 'current' | 'all' | cutoffId
    type: 'all',       // 'all' | 'expense' | 'income' | 'loans'
    categoryId: 'all',
    sortBy: 'newest',  // 'newest' | 'oldest' | 'highest' | 'lowest'
  };

  function updateView() {
    container.innerHTML = '';

    const categories = store.getCategories();
    const curCutoff = store.getCurrentCutoff();
    const allTxs = store.getTransactions();

    // Collect available cutoffs from store & history
    const periodMap = new Map();
    if (curCutoff) {
      periodMap.set('current', {
        id: 'current',
        cutoffId: curCutoff.id,
        label: `${curCutoff.label} (Current)`,
        isCurrent: true,
      });
    }

    allTxs.forEach(t => {
      if (t.cutoffId && t.cutoffLabel && (!curCutoff || t.cutoffId !== curCutoff.id)) {
        if (!periodMap.has(t.cutoffId)) {
          periodMap.set(t.cutoffId, {
            id: t.cutoffId,
            cutoffId: t.cutoffId,
            label: t.cutoffLabel,
            isCurrent: false,
          });
        }
      }
    });

    // Header & Actions
    const topBar = document.createElement('div');
    topBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.5rem;';
    topBar.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.45rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
          ${ICONS.history} History
        </h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin: 0.2rem 0 0 0;">
          Filter by pay period, search, and manage records
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
    filterCard.style.marginBottom = '1.25rem';

    filterCard.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
        <!-- Search Input -->
        <input 
          type="text" 
          id="tx-search-input" 
          class="form-input" 
          placeholder="Search by note, borrower, or category..."
          value="${escapeHtml(currentFilter.search)}"
          style="width: 100%; box-sizing: border-box;"
        >

        <!-- Filters 2-Column Grid (Period, Sort, Type, Category) -->
        <div class="tx-filter-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>
            <label style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; display: block;">Period</label>
            <select id="tx-period-filter" class="form-select tx-filter-select" style="width: 100%;">
              <option value="current" ${currentFilter.period === 'current' ? 'selected' : ''}>
                ${curCutoff ? `${curCutoff.label} (Current)` : 'Current Cutoff'}
              </option>
              <option value="all" ${currentFilter.period === 'all' ? 'selected' : ''}>
                All Time
              </option>
              ${Array.from(periodMap.values()).filter(p => !p.isCurrent).map(p => `
                <option value="${escapeHtml(p.id)}" ${currentFilter.period === p.id ? 'selected' : ''}>
                  ${escapeHtml(p.label)}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; display: block;">Sort</label>
            <select id="tx-sort-filter" class="form-select tx-filter-select" style="width: 100%;">
              <option value="newest" ${currentFilter.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="oldest" ${currentFilter.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
              <option value="highest" ${currentFilter.sortBy === 'highest' ? 'selected' : ''}>High &rarr; Low</option>
              <option value="lowest" ${currentFilter.sortBy === 'lowest' ? 'selected' : ''}>Low &rarr; High</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; display: block;">Type</label>
            <select id="tx-type-filter" class="form-select tx-filter-select" style="width: 100%;">
              <option value="all" ${currentFilter.type === 'all' ? 'selected' : ''}>All Types</option>
              <option value="expense" ${currentFilter.type === 'expense' ? 'selected' : ''}>Expenses Only</option>
              <option value="income" ${currentFilter.type === 'income' ? 'selected' : ''}>Income Only</option>
              <option value="loans" ${currentFilter.type === 'loans' ? 'selected' : ''}>Loans (Hiram)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.2rem; display: block;">Category</label>
            <select id="tx-cat-filter" class="form-select tx-filter-select" style="width: 100%;">
              <option value="all" ${currentFilter.categoryId === 'all' ? 'selected' : ''}>All Categories</option>
              ${categories.map(c => `
                <option value="${escapeHtml(c.id)}" ${currentFilter.categoryId === c.id ? 'selected' : ''}>
                  ${escapeHtml(c.name)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>
    `;

    const searchInput = filterCard.querySelector('#tx-search-input');
    searchInput.oninput = (e) => {
      currentFilter.search = e.target.value;
      visibleLimit = PAGE_SIZE;
      renderListOnly();
    };

    const periodSelect = filterCard.querySelector('#tx-period-filter');
    periodSelect.onchange = (e) => {
      playPop();
      currentFilter.period = e.target.value;
      visibleLimit = PAGE_SIZE;
      renderListOnly();
    };

    const sortSelect = filterCard.querySelector('#tx-sort-filter');
    sortSelect.onchange = (e) => {
      playPop();
      currentFilter.sortBy = e.target.value;
      renderListOnly();
    };

    const typeSelect = filterCard.querySelector('#tx-type-filter');
    typeSelect.onchange = (e) => {
      playPop();
      currentFilter.type = e.target.value;
      visibleLimit = PAGE_SIZE;
      renderListOnly();
    };

    const catSelect = filterCard.querySelector('#tx-cat-filter');
    catSelect.onchange = (e) => {
      playPop();
      currentFilter.categoryId = e.target.value;
      visibleLimit = PAGE_SIZE;
      renderListOnly();
    };

    container.appendChild(filterCard);

    // List Container
    const listWrapper = document.createElement('div');
    listWrapper.id = 'tx-list-wrapper';
    container.appendChild(listWrapper);

    renderListOnly();
  }

  function getFilteredTransactions() {
    const curCutoff = store.getCurrentCutoff();
    let list = store.getTransactions();

    // 1. Period Filter
    if (currentFilter.period === 'current') {
      if (curCutoff) {
        list = list.filter(t =>
          t.cutoffId === curCutoff.id || (t.date && isDateInRange(t.date, curCutoff.start, curCutoff.end))
        );
      }
    } else if (currentFilter.period !== 'all') {
      list = list.filter(t => t.cutoffId === currentFilter.period);
    }

    // 2. Type Filter
    if (currentFilter.type === 'expense') {
      list = list.filter(t => t.type === 'expense');
    } else if (currentFilter.type === 'income') {
      list = list.filter(t => t.type === 'income');
    } else if (currentFilter.type === 'loans') {
      list = list.filter(t => Boolean(t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))));
    }

    // 3. Category Filter
    if (currentFilter.categoryId && currentFilter.categoryId !== 'all') {
      list = list.filter(t => t.categoryId === currentFilter.categoryId);
    }

    // 4. Search Filter
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      list = list.filter(t =>
        (t.note && t.note.toLowerCase().includes(q)) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(q)) ||
        (t.borrowerName && t.borrowerName.toLowerCase().includes(q))
      );
    }

    // 5. Sorting
    if (currentFilter.sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
    } else if (currentFilter.sortBy === 'highest') {
      list.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0));
    } else if (currentFilter.sortBy === 'lowest') {
      list.sort((a, b) => (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0));
    } else {
      // Default: newest first
      list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    }

    return list;
  }

  function renderListOnly() {
    const listWrapper = container.querySelector('#tx-list-wrapper');
    if (!listWrapper) return;

    const settings = store.getSettings();
    const curr = settings.currency || '₱';
    const allFiltered = getFilteredTransactions();
    const totalCount = allFiltered.length;

    if (totalCount === 0) {
      listWrapper.innerHTML = `
        <div class="cloud-card" style="text-align: center; padding: 2.75rem 1.25rem;">
          <div style="width: 48px; height: 48px; margin: 0 auto 0.75rem auto; color: var(--text-muted);">${ICONS.history}</div>
          <h3 style="font-family: var(--font-display); font-size: 1.15rem; margin: 0 0 0.35rem 0;">No matching transactions found</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0 0 1rem 0;">Try changing your period filter or search term.</p>
          ${currentFilter.period !== 'all' || currentFilter.type !== 'all' || currentFilter.categoryId !== 'all' || currentFilter.search ? `
            <button class="pill squish-btn" id="reset-filters-btn" style="border: 1px solid var(--border-color); background: var(--bg-card-cloud); font-size: 0.78rem; font-weight: 700; padding: 0.4rem 0.9rem; border-radius: var(--radius-full); cursor: pointer;">
              Reset Filters to All Time
            </button>
          ` : ''}
        </div>
      `;
      const resetBtn = listWrapper.querySelector('#reset-filters-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          playPop();
          currentFilter = { search: '', period: 'all', type: 'all', categoryId: 'all', sortBy: 'newest' };
          visibleLimit = PAGE_SIZE;
          updateView();
        };
      }
      return;
    }

    const visibleItems = allFiltered.slice(0, visibleLimit);
    const hasMore = visibleLimit < totalCount;

    // Compute net for this filtered set
    const netTotal = allFiltered.reduce((acc, t) => t.type === 'expense' ? acc - (parseFloat(t.amount) || 0) : acc + (parseFloat(t.amount) || 0), 0);

    let html = `
      <!-- Summary Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding: 0 0.35rem; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); flex-wrap: wrap; gap: 0.35rem;">
        <span>Showing <strong style="color: var(--text-main);">${visibleItems.length}</strong> of <strong style="color: var(--text-main);">${totalCount}</strong> records</span>
        <span>Period Net: <strong style="color: ${netTotal >= 0 ? 'var(--mint-deep)' : 'var(--coral-alert)'}">${formatCurrency(netTotal, curr)}</strong></span>
      </div>

      <div class="cloud-card" style="display: flex; flex-direction: column; gap: 0.65rem; padding: 0.85rem;">
    `;

    visibleItems.forEach(t => {
      const isLoanTx = Boolean(t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)')));
      const isRepaidLoan = isLoanTx && t.loanStatus === 'repaid';
      const isUnpaidLoan = isLoanTx && t.loanStatus !== 'repaid' && t.type === 'expense';

      html += `
        <div class="tx-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.7rem 0.75rem; border-radius: var(--radius-md); background: var(--bg-card-cloud); border: 1px solid var(--border-color); gap: 0.65rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
            <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
              ${getCategoryIconSvg(t.categoryId || t.categoryName)}
            </div>
            <div style="min-width: 0;">
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(stripEmojis(t.note) || stripEmojis(t.categoryName))}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; margin-top: 0.12rem;">
                <span>${formatDate(t.date)}</span> &bull; 
                <span class="pill" style="padding: 0.08rem 0.45rem; font-size: 0.68rem;">${escapeHtml(stripEmojis(t.categoryName))}</span>
                ${isLoanTx ? `
                  <span class="pill" style="padding: 0.06rem 0.4rem; font-size: 0.66rem; font-weight: 800; background: ${isRepaidLoan ? 'rgba(86,193,144,0.15)' : 'rgba(255,171,0,0.15)'}; color: ${isRepaidLoan ? 'var(--mint-deep)' : '#B37400'}; border: 1px solid ${isRepaidLoan ? 'rgba(86,193,144,0.4)' : 'rgba(255,171,0,0.4)'};">
                    ${isRepaidLoan ? '✓ Repaid' : '🤝 Hiram'}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
            ${isUnpaidLoan ? `
              <button class="btn btn-sm squish-btn tx-repay-btn" data-id="${t.id}" title="Mark Paid Back" style="padding: 0.22rem 0.55rem; font-size: 0.7rem; font-weight: 800; border-radius: var(--radius-full); background: rgba(86, 193, 144, 0.15); color: var(--mint-deep); border: 1.5px solid var(--mint-deep); cursor: pointer; white-space: nowrap;">
                Mark Paid
              </button>
            ` : ''}
            <span style="font-family: var(--font-display); font-weight: 800; font-size: 1rem; color: ${
              t.type === 'income' ? 'var(--mint-deep)' : 'var(--coral-alert)'
            };">
              ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, curr)}
            </span>
            <button class="icon-btn tx-edit-btn" data-id="${t.id}" title="Edit record" style="width: 30px; height: 30px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer;">
              ${ICONS.edit}
            </button>
            <button class="icon-btn tx-delete-btn" data-id="${t.id}" title="Delete record" style="width: 30px; height: 30px; color: var(--coral-alert); display: flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer;">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    // Pagination / Load More Footer
    if (hasMore) {
      const nextBatch = Math.min(PAGE_SIZE, totalCount - visibleItems.length);
      html += `
        <div style="margin-top: 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.45rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
            Showing ${visibleItems.length} of ${totalCount} records
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button id="tx-load-more-btn" class="btn btn-primary squish-btn" style="padding: 0.45rem 1.15rem; font-size: 0.78rem; font-weight: 800; border-radius: var(--radius-full); cursor: pointer;">
              Load More (+${nextBatch})
            </button>
            <button id="tx-show-all-btn" class="pill squish-btn" style="border: 1px solid var(--border-color); background: var(--bg-card-cloud); color: var(--text-main); padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-full); cursor: pointer;">
              Show All (${totalCount})
            </button>
          </div>
        </div>
      `;
    } else if (totalCount > PAGE_SIZE) {
      html += `
        <div style="margin-top: 1rem; text-align: center; font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">
          ✓ All ${totalCount} transactions for this filter are displayed
        </div>
      `;
    }

    listWrapper.innerHTML = html;

    // Hook Load More and Show All
    const loadMoreBtn = listWrapper.querySelector('#tx-load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => {
        playPop();
        visibleLimit += PAGE_SIZE;
        renderListOnly();
      };
    }

    const showAllBtn = listWrapper.querySelector('#tx-show-all-btn');
    if (showAllBtn) {
      showAllBtn.onclick = () => {
        playPop();
        visibleLimit = totalCount;
        renderListOnly();
      };
    }

    // Hook Repay buttons
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

    // Hook Edit buttons
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

    // Hook Delete buttons
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
              renderListOnly();
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

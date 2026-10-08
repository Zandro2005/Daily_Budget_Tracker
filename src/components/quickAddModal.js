// ====================================================================
// LYKA WALLET - SIMPLE QUICK ADD MODAL
// Clean, elegant logger with cutoff range pill, strict savings protection,
// and real-time tight budget warnings
// ====================================================================

import { store } from '../lib/store.js';
import { getTodayDateString, formatCurrency } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from './toast.js';
import { ICONS } from '../lib/icons.js';

let modalInstance = null;
let currentSelectedType = 'expense';

export function openQuickAddModal(initialType = 'expense', options = {}) {
  try {
    // Dismiss any active day-detail modal so it cannot block or cover the add form
    document.querySelectorAll('.day-detail-backdrop').forEach(b => {
      b.classList.remove('open');
      b.remove();
    });

    if (!modalInstance) {
      modalInstance = createModalDOM();
    }
    // Always re-append to ensure it sits on top in DOM order
    document.body.appendChild(modalInstance);

    resetModalState(initialType, options.date);
    modalInstance.classList.add('open');
    const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const amountInput = modalInstance.querySelector('#qa-amount');
    if (!isTouch && amountInput) {
      setTimeout(() => amountInput.focus(), 150);
    }
  } catch (err) {
    console.error('Error opening quick add modal:', err);
  }
}

export function closeQuickAddModal() {
  if (modalInstance) {
    modalInstance.classList.remove('open');
  }
}

function resetModalState(type = 'expense', presetDate = null) {
  if (!modalInstance) return;
  currentSelectedType = type;
  const form = modalInstance.querySelector('#qa-form');
  if (form) form.reset();

  const dialog = modalInstance.querySelector('.modal-dialog');
  if (dialog) dialog.scrollTop = 0;

  const typeButtons = modalInstance.querySelectorAll('.qa-type-btn');
  typeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const dateInput = modalInstance.querySelector('#qa-date');
  if (dateInput) dateInput.value = presetDate || getTodayDateString();

  renderCategoryChips(type, modalInstance);
  updateBudgetValidation(modalInstance);
}

function renderCategoryChips(type, root = modalInstance) {
  if (!root) return;
  const container = root.querySelector('#qa-category-list');
  if (!container) return;
  container.innerHTML = '';

  const categories = store.getCategories();
  const filtered = type === 'income'
    ? categories.filter(c => c.name.toLowerCase().includes('income') || c.monthly_limit === 0)
    : categories.filter(c => !c.name.toLowerCase().includes('income'));

  const displayList = filtered.length > 0 ? filtered : categories;

  displayList.forEach((cat, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `qa-cat-pill ${index === 0 ? 'selected' : ''}`;
    pill.dataset.id = cat.id;
    pill.textContent = cat.name;

    if (displayList.length % 2 === 1 && index === displayList.length - 1) {
      pill.style.gridColumn = '1 / -1';
    }

    pill.addEventListener('click', (e) => {
      e.preventDefault();
      playPop();
      container.querySelectorAll('.qa-cat-pill').forEach(c => c.classList.remove('selected'));
      pill.classList.add('selected');
    });

    container.appendChild(pill);
  });
}

function updateBudgetValidation(root = modalInstance) {
  if (!root) return;
  const dateInput = root.querySelector('#qa-date');
  const amountInput = root.querySelector('#qa-amount');
  const cutoffPill = root.querySelector('#qa-cutoff-pill');
  const alertEl = root.querySelector('#qa-budget-alert');
  const submitBtn = root.querySelector('.qa-submit-btn');
  if (!cutoffPill || !alertEl || !submitBtn) return;

  const dateVal = (dateInput && dateInput.value) ? dateInput.value : getTodayDateString();
  const txDate = new Date(dateVal + (dateVal.includes('T') ? '' : 'T00:00:00'));
  const cutoff = store.getCurrentCutoff(txDate);
  const summary = store.getCutoffSummary(cutoff);
  const curr = store.getSettings().currency || '₱';

  // Update Cutoff Pill at Top
  cutoffPill.textContent = cutoff.label;

  // Validation & Warnings
  if (currentSelectedType === 'income') {
    alertEl.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    return;
  }

  // Expense mode:
  const amountVal = parseFloat(amountInput.value) || 0;

  if (summary.budgetLimit <= 0) {
    // Insufficient income: No income logged yet for this cutoff!
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
    alertEl.style.border = '1.5px solid var(--coral-alert)';
    alertEl.style.color = '#B91C1C';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>No Income Logged for ${cutoff.label}</span>
      </div>
      <div>Expenses cannot be logged until income is recorded. Savings is protected.</div>
    `;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  } else if (amountVal > summary.remainingBudget) {
    // Insufficient spend budget: exceeds spend budget and would compromise savings!
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
    alertEl.style.border = '1.5px solid var(--coral-alert)';
    alertEl.style.color = '#B91C1C';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Insufficient Spend Budget</span>
      </div>
      <div>Only <strong>${formatCurrency(summary.remainingBudget, curr)}</strong> left in this cutoff. Savings of <strong>${formatCurrency(summary.plan.savingsTarget, curr)}</strong> is protected and cannot be touched.</div>
    `;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  } else if (amountVal > 0 && (summary.remainingBudget - amountVal) <= summary.budgetLimit * 0.20) {
    // Tight Budget Warning on prospective expense!
    const remAfter = Math.max(0, summary.remainingBudget - amountVal);
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 251, 230, 0.95)';
    alertEl.style.border = '1.5px solid #FFD666';
    alertEl.style.color = '#8C6D00';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Tight Budget Alert</span>
      </div>
      <div>This expense leaves only <strong>${formatCurrency(remAfter, curr)}</strong> remaining for this cutoff (${cutoff.label}). Savings (${formatCurrency(summary.plan.savingsTarget, curr)}) remains safe.</div>
    `;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
  } else if (summary.isTight && amountVal === 0) {
    // Budget is currently tight
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 251, 230, 0.95)';
    alertEl.style.border = '1.5px solid #FFD666';
    alertEl.style.color = '#8C6D00';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Budget is Tight</span>
      </div>
      <div>Only <strong>${formatCurrency(summary.remainingBudget, curr)}</strong> left (${Math.round(summary.usagePercent)}% used) for ${cutoff.label}. Savings (${formatCurrency(summary.plan.savingsTarget, curr)}) is safe.</div>
    `;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
  } else {
    alertEl.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
  }
}

function createModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop qa-modal-backdrop';
  modalInstance = backdrop;

  const curr = store.getSettings().currency || '₱';

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <h3 class="modal-title" style="margin: 0;">Add Transaction</h3>
          <!-- Cutoff Range Pill on the top only -->
          <span id="qa-cutoff-pill" class="pill" style="font-size: 0.68rem; font-weight: 800; background: #FFF9E6; border: 1px solid #FFE58F; color: #8C6D00; padding: 0.08rem 0.45rem; border-radius: var(--radius-full);">
            Cutoff
          </span>
        </div>
        <button class="modal-close" id="qa-close-btn" type="button" aria-label="Close">&times;</button>
      </div>

      <!-- Symmetrical 50/50 Type Switcher (No Emojis) -->
      <div class="qa-type-toggle">
        <button type="button" class="qa-type-btn ${currentSelectedType === 'expense' ? 'active' : ''}" data-type="expense">
          Expense
        </button>
        <button type="button" class="qa-type-btn ${currentSelectedType === 'income' ? 'active' : ''}" data-type="income">
          Income
        </button>
      </div>

      <form id="qa-form">
        <!-- Dynamic Budget Alert / Insufficient Notice -->
        <div id="qa-budget-alert" style="display: none; margin-bottom: 0.85rem; font-size: 0.76rem; border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; line-height: 1.35;"></div>

        <!-- Centered Hero Amount Input -->
        <div class="qa-field-group">
          <label class="form-label" for="qa-amount">Amount</label>
          <div class="qa-amount-wrap">
            <div class="qa-amount-inner">
              <span class="qa-currency">${curr}</span>
              <input 
                type="number" 
                id="qa-amount" 
                class="qa-amount-input" 
                placeholder="0.00" 
                step="any" 
                inputmode="decimal" 
                required
              >
            </div>
          </div>
        </div>

        <!-- Symmetrical 2-Column Categories (Clean Text, No Emojis) -->
        <div class="qa-cat-wrap">
          <label class="form-label">Category</label>
          <div id="qa-category-list" class="qa-cat-list"></div>
        </div>

        <!-- Symmetrical 50/50 Note & Date Grid -->
        <div class="qa-row-grid">
          <div>
            <label class="form-label" for="qa-note">Note (optional)</label>
            <input type="text" id="qa-note" class="form-input" placeholder="e.g. Groceries">
          </div>
          <div>
            <label class="form-label" for="qa-date">Date</label>
            <input type="date" id="qa-date" class="form-input" value="${getTodayDateString()}">
          </div>
        </div>

        <!-- Balanced Full-Width Save Button -->
        <button type="submit" class="qa-submit-btn squish-btn">
          Save Transaction
        </button>
      </form>
    </div>
  `;

  // Close handlers
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeQuickAddModal();
  });
  backdrop.querySelector('#qa-close-btn').addEventListener('click', closeQuickAddModal);

  // Type Switcher handler
  const typeButtons = backdrop.querySelectorAll('.qa-type-btn');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playPop();
      const nextType = btn.dataset.type;
      currentSelectedType = nextType;
      typeButtons.forEach(b => b.classList.toggle('active', b.dataset.type === nextType));
      renderCategoryChips(nextType, backdrop);
      updateBudgetValidation(backdrop);
    });
  });

  // Amount input event for real-time validation
  const amountInput = backdrop.querySelector('#qa-amount');
  amountInput.addEventListener('input', () => {
    updateBudgetValidation(backdrop);
  });

  // Date input change event
  const dateInput = backdrop.querySelector('#qa-date');
  dateInput.addEventListener('change', () => {
    updateBudgetValidation(backdrop);
  });

  // Form submit
  backdrop.querySelector('#qa-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amountVal = parseFloat(backdrop.querySelector('#qa-amount').value);
    if (!amountVal || amountVal <= 0) return;

    const selectedCatEl = backdrop.querySelector('.qa-cat-pill.selected');
    const categoryId = selectedCatEl ? selectedCatEl.dataset.id : null;
    const isIncome = currentSelectedType === 'income' || categoryId === 'cat-income';
    const selectedType = isIncome ? 'income' : 'expense';
    const note = backdrop.querySelector('#qa-note').value;
    const date = backdrop.querySelector('#qa-date').value;

    const txDate = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
    const cutoff = store.getCurrentCutoff(txDate);
    const summary = store.getCutoffSummary(cutoff);
    const currentCurr = store.getSettings().currency || '₱';

    // Strict validation
    if (selectedType === 'expense') {
      if (summary.budgetLimit <= 0) {
        playPop();
        showToast({ text: `Cannot log expense: No income logged yet for ${cutoff.label}. Please log income first.` });
        return;
      }
      if (amountVal > summary.remainingBudget) {
        playPop();
        showToast({ text: `Insufficient spend budget! Only ${formatCurrency(summary.remainingBudget, currentCurr)} available.` });
        return;
      }
    }

    try {
      const newTx = store.addTransaction({
        type: selectedType,
        amount: amountVal,
        categoryId,
        note,
        date,
      });

      playCoin();
      if (selectedType === 'income' || amountVal >= 1000) {
        firePastelConfetti();
      }

      showToast({
        text: `Saved ${selectedType === 'income' ? '+' : '-'}${formatCurrency(amountVal, currentCurr)}`,
        icon: 'check',
        onUndo: () => {
          store.deleteTransaction(newTx.id);
          showToast({ text: 'Record removed' });
        },
      });

      closeQuickAddModal();
    } catch (err) {
      playPop();
      showToast({ text: err.message });
      const alertEl = backdrop.querySelector('#qa-budget-alert');
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
        alertEl.style.border = '1.5px solid var(--coral-alert)';
        alertEl.style.color = '#B91C1C';
        alertEl.textContent = err.message;
      }
    }
  });

  return backdrop;
}

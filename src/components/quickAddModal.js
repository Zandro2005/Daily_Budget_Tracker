// ====================================================================
// LYKA WALLET - QUICK ADD & EDIT TRANSACTION MODAL
// Clean, elegant logger with cutoff range pill, strict savings protection,
// symmetrical layout, and full transaction editing support.
// ====================================================================

import { store } from '../lib/store.js';
import { getTodayDateString, formatCurrency } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from './toast.js';
import { ICONS } from '../lib/icons.js';

let modalInstance = null;
let currentSelectedType = 'expense';
let currentEditingTx = null;

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

    currentEditingTx = options.editTx || null;
    resetModalState(initialType, options.date, currentEditingTx);
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
    currentEditingTx = null;
  }
}

function resetModalState(type = 'expense', presetDate = null, editTx = null) {
  if (!modalInstance) return;
  const isLoanTx = Boolean(editTx && (editTx.isLoan || (editTx.note && editTx.note.toLowerCase().includes('(hiram)'))));
  const targetType = editTx ? (isLoanTx ? 'borrow' : editTx.type) : type;
  currentSelectedType = targetType;
  currentEditingTx = editTx || null;

  const form = modalInstance.querySelector('#qa-form');
  if (form) form.reset();

  const dialog = modalInstance.querySelector('.modal-dialog');
  if (dialog) dialog.scrollTop = 0;

  const titleEl = modalInstance.querySelector('#qa-modal-title');
  if (titleEl) {
    titleEl.textContent = editTx
      ? (isLoanTx ? 'Edit Hiram (Loan)' : 'Edit Transaction')
      : (targetType === 'borrow' ? 'Record Hiram (Lend Money)' : 'Add Transaction');
  }

  const submitBtn = modalInstance.querySelector('#qa-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = editTx
      ? 'Save Changes'
      : (targetType === 'borrow' ? 'Record Hiram' : 'Save Transaction');
  }

  const typeButtons = modalInstance.querySelectorAll('.qa-type-btn');
  typeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === targetType);
  });

  const borrowerWrap = modalInstance.querySelector('#qa-borrower-wrap');
  const borrowerInput = modalInstance.querySelector('#qa-borrower');
  if (borrowerWrap) {
    borrowerWrap.style.display = targetType === 'borrow' ? 'block' : 'none';
  }
  if (borrowerInput) {
    borrowerInput.value = editTx ? (editTx.borrowerName || '') : '';
  }

  const savingsWrap = modalInstance.querySelector('#qa-savings-wrap');
  if (savingsWrap) {
    savingsWrap.style.display = targetType === 'income' ? 'block' : 'none';
  }
  const savingsInput = modalInstance.querySelector('#qa-savings-amount');
  if (savingsInput) {
    savingsInput.value = editTx ? (editTx.savingsAmount !== undefined ? editTx.savingsAmount : 0) : 0;
  }
  const savingsPills = modalInstance.querySelectorAll('.qa-savings-pill');
  if (savingsPills.length > 0) {
    savingsPills.forEach(b => b.classList.toggle('active', b.dataset.preset === (editTx && editTx.savingsAmount > 0 ? 'custom' : '0')));
  }

  const amountInput = modalInstance.querySelector('#qa-amount');
  if (amountInput) {
    amountInput.value = editTx ? editTx.amount : '';
  }

  const noteInput = modalInstance.querySelector('#qa-note');
  if (noteInput) {
    noteInput.value = editTx ? (editTx.note || '') : '';
  }

  const dateInput = modalInstance.querySelector('#qa-date');
  if (dateInput) {
    dateInput.value = editTx ? editTx.date : (presetDate || getTodayDateString());
  }

  renderCategoryChips(targetType, modalInstance, editTx ? editTx.categoryId : (targetType === 'borrow' ? 'cat-daily' : null));
  updateSavingsCalculation(modalInstance);
  updateBudgetValidation(modalInstance);
}

function updateSavingsCalculation(root = modalInstance) {
  if (!root) return;
  const savingsWrap = root.querySelector('#qa-savings-wrap');
  if (!savingsWrap || savingsWrap.style.display === 'none') return;

  const curr = store.getSettings().currency || '₱';
  const amountInput = root.querySelector('#qa-amount');
  const savingsInput = root.querySelector('#qa-savings-amount');
  const badgeEl = root.querySelector('#qa-savings-badge');
  const impactEl = root.querySelector('#qa-savings-impact-text');
  const ruleBtn = root.querySelector('.qa-savings-pill[data-preset="rule"]');

  const amountVal = parseFloat(amountInput?.value) || 0;
  const savingsRate = store.getSavingsRate();
  const rulePct = Math.round(savingsRate * 100);

  if (ruleBtn) {
    const ruleAmt = Math.round(amountVal * savingsRate);
    ruleBtn.textContent = `${rulePct}% Rule${amountVal > 0 ? ` (${formatCurrency(ruleAmt, curr)})` : ''}`;
  }

  const currentSavingsVal = parseFloat(savingsInput?.value) || 0;
  const clampedSavings = Math.max(0, Math.min(amountVal, currentSavingsVal));
  const spendVal = Math.max(0, amountVal - clampedSavings);

  if (badgeEl) {
    if (clampedSavings === 0) {
      badgeEl.textContent = '₱0 to savings (100% to spend)';
    } else {
      const pct = amountVal > 0 ? Math.round((clampedSavings / amountVal) * 100) : 0;
      badgeEl.textContent = `${formatCurrency(clampedSavings, curr)} (${pct}%) saved`;
    }
  }

  if (impactEl) {
    impactEl.textContent = `+${formatCurrency(spendVal, curr)} to Spend Budget • ${formatCurrency(clampedSavings, curr)} to Savings`;
  }
}

function renderCategoryChips(type, root = modalInstance, selectedCategoryId = null) {
  if (!root) return;
  const catWrap = root.querySelector('#qa-cat-wrap') || root.querySelector('.qa-cat-wrap');
  if (catWrap) {
    catWrap.style.display = type === 'income' ? 'none' : 'block';
  }
  if (type === 'income') {
    return; // Category is completely removed from the income form!
  }

  const container = root.querySelector('#qa-category-list');
  if (!container) return;
  container.innerHTML = '';

  const catLabel = root.querySelector('#qa-cat-label');
  let helper = root.querySelector('#qa-cat-helper');
  if (!helper) {
    helper = document.createElement('div');
    helper.id = 'qa-cat-helper';
    helper.style.cssText = 'font-size: 0.72rem; color: var(--text-muted); margin: -0.25rem 0 0.45rem 0; line-height: 1.35;';
    if (catLabel && catLabel.parentNode) {
      catLabel.parentNode.insertBefore(helper, container);
    }
  }

  if (catLabel) {
    catLabel.textContent = type === 'borrow'
      ? 'Minus from which envelope / budget cut:'
      : 'Envelope / Category';
  }

  if (type === 'borrow') {
    helper.textContent = 'Minuses directly from this envelope\'s allocated funds.';
    helper.style.display = 'block';
  } else {
    helper.style.display = 'none';
  }

  const categories = store.getCategories();
  const displayList = categories.filter(c => !c.name.toLowerCase().includes('income'));

  const defaultSelectedId = selectedCategoryId || (
    type === 'borrow'
      ? (displayList.find(c => c.id === 'cat-daily' || c.name.toLowerCase().includes('allowance'))?.id || displayList[0]?.id)
      : displayList[0]?.id
  );

  displayList.forEach((cat, index) => {
    const isSelected = cat.id === defaultSelectedId;
    const isMisc = cat.id === 'cat-misc' || cat.name.toLowerCase().includes('misc');
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `qa-cat-pill ${isSelected ? 'selected' : ''}`;
    pill.dataset.id = cat.id;
    pill.textContent = cat.name;
    if (isMisc) {
      pill.title = `${cat.name} (Flexible envelope - no budget needed)`;
    }

    if (displayList.length % 2 === 1 && index === displayList.length - 1) {
      pill.style.gridColumn = '1 / -1';
    }

    pill.addEventListener('click', (e) => {
      e.preventDefault();
      playPop();
      container.querySelectorAll('.qa-cat-pill').forEach(c => c.classList.remove('selected'));
      pill.classList.add('selected');
      updateBudgetValidation(root);
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
  const submitBtn = root.querySelector('#qa-submit-btn');
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

  // Expense / Hiram mode:
  const amountVal = parseFloat(amountInput.value) || 0;

  // 1. Cutoff Spend Budget Remaining
  let effectiveTotalRemaining = summary.remainingBudget;
  if (currentEditingTx && currentEditingTx.type === 'expense') {
    effectiveTotalRemaining += (parseFloat(currentEditingTx.amount) || 0);
  }

  // 2. Selected Envelope Budget Remaining
  const selectedCatPill = root.querySelector('.qa-cat-pill.selected');
  const selectedCatId = selectedCatPill ? selectedCatPill.dataset.id : null;
  const catSpending = store.getCutoffCategorySpending(cutoff);
  const selectedCatSpend = catSpending.find(c => c.id === selectedCatId);

  let effectiveCatRemaining = null;
  let catTotalFunds = 0;
  let catSpent = 0;
  let catName = selectedCatSpend ? selectedCatSpend.name : 'Envelope';
  const isMisc = selectedCatSpend && (selectedCatSpend.id === 'cat-misc' || selectedCatSpend.name.toLowerCase().includes('misc'));

  if (selectedCatSpend) {
    catTotalFunds = selectedCatSpend.totalFunds;
    catSpent = selectedCatSpend.spent;
    let baseRemaining = catTotalFunds - catSpent;
    if (currentEditingTx && currentEditingTx.type === 'expense' && currentEditingTx.categoryId === selectedCatId) {
      baseRemaining += (parseFloat(currentEditingTx.amount) || 0);
    }
    effectiveCatRemaining = baseRemaining;
  }

  const isLoan = currentSelectedType === 'borrow';

  if (summary.budgetLimit <= 0 && !currentEditingTx) {
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
  } else if (selectedCatSpend && !isMisc && catTotalFunds <= 0) {
    // Envelope has NO budget allocated!
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
    alertEl.style.border = '1.5px solid var(--coral-alert)';
    alertEl.style.color = '#B91C1C';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>No Budget Allocated for "${catName}"</span>
      </div>
      <div>This envelope has <strong>${curr} 0</strong> allocated for ${cutoff.label}. Set a budget for "${catName}" in the Planner first before logging ${isLoan ? 'loans' : 'expenses'}.</div>
    `;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  } else if (selectedCatSpend && !isMisc && effectiveCatRemaining !== null && amountVal > effectiveCatRemaining) {
    // Exceeds Envelope Allocation Budget!
    const overAmt = amountVal - effectiveCatRemaining;
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
    alertEl.style.border = '1.5px solid var(--coral-alert)';
    alertEl.style.color = '#B91C1C';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Exceeds "${catName}" Envelope Budget</span>
      </div>
      <div>Only <strong>${formatCurrency(Math.max(0, effectiveCatRemaining), curr)}</strong> remaining in "${catName}" (${formatCurrency(catSpent, curr)} spent of ${formatCurrency(catTotalFunds, curr)}). This ${isLoan ? 'loan' : 'expense'} exceeds it by <strong>${formatCurrency(overAmt, curr)}</strong> and will not be logged.</div>
    `;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  } else if (amountVal > effectiveTotalRemaining) {
    // Insufficient total spend budget!
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 235, 237, 0.95)';
    alertEl.style.border = '1.5px solid var(--coral-alert)';
    alertEl.style.color = '#B91C1C';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Insufficient Cutoff Spend Budget</span>
      </div>
      <div>Only <strong>${formatCurrency(effectiveTotalRemaining, curr)}</strong> available in total cutoff spend budget. Savings (${formatCurrency(summary.plan.savingsTarget, curr)}) is strictly protected.</div>
    `;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  } else if (amountVal > 0 && (effectiveTotalRemaining - amountVal) <= summary.budgetLimit * 0.20) {
    // Tight Budget Warning on prospective expense!
    const remAfter = Math.max(0, effectiveTotalRemaining - amountVal);
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(255, 251, 230, 0.95)';
    alertEl.style.border = '1.5px solid #FFD666';
    alertEl.style.color = '#8C6D00';
    alertEl.innerHTML = `
      <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
        <span style="display: flex; width: 15px; height: 15px;">${ICONS.alertTriangle}</span>
        <span>Tight Budget Alert</span>
      </div>
      <div>This expense leaves <strong>${formatCurrency(remAfter, curr)}</strong> remaining for this cutoff (${cutoff.label}). Savings (${formatCurrency(summary.plan.savingsTarget, curr)}) remains safe.</div>
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
          <h3 class="modal-title" id="qa-modal-title" style="margin: 0;">Add Transaction</h3>
          <!-- Cutoff Range Pill on the top only -->
          <span id="qa-cutoff-pill" class="pill" style="font-size: 0.68rem; font-weight: 800; background: #FFF9E6; border: 1px solid #FFE58F; color: #8C6D00; padding: 0.08rem 0.45rem; border-radius: var(--radius-full);">
            Cutoff
          </span>
        </div>
        <button class="modal-close" id="qa-close-btn" type="button" aria-label="Close">&times;</button>
      </div>

      <!-- Symmetrical 3-Way Type Switcher (Expense, Income, Hiram) -->
      <div class="qa-type-toggle" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.35rem; background: var(--bg-card-cloud); padding: 0.25rem; border-radius: var(--radius-full); border: 1px solid var(--border-color); margin-bottom: 1rem;">
        <button type="button" class="qa-type-btn ${currentSelectedType === 'expense' ? 'active' : ''}" data-type="expense">
          Expense
        </button>
        <button type="button" class="qa-type-btn ${currentSelectedType === 'income' ? 'active' : ''}" data-type="income">
          Income
        </button>
        <button type="button" class="qa-type-btn ${currentSelectedType === 'borrow' ? 'active' : ''}" data-type="borrow">
          Hiram (Lend)
        </button>
      </div>

      <form id="qa-form">
        <!-- Dynamic Budget Alert / Insufficient Notice -->
        <div id="qa-budget-alert" style="display: none; margin-bottom: 0.85rem; font-size: 0.76rem; border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; line-height: 1.35;"></div>

        <!-- Borrower Name Field (Displayed when Hiram is selected) -->
        <div id="qa-borrower-wrap" class="qa-field-group" style="display: ${currentSelectedType === 'borrow' ? 'block' : 'none'}; margin-bottom: 0.85rem;">
          <label class="form-label" for="qa-borrower">Who borrowed? (Borrower Name)</label>
          <input type="text" id="qa-borrower" class="form-input" placeholder="e.g. Ate Trish" style="font-weight: 700;">
          <small style="color: #8C6D00; font-size: 0.72rem; display: block; margin-top: 0.25rem;">
            Will automatically minus from your selected envelope below for this cutoff.
          </small>
        </div>

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
                placeholder="0" 
                step="any" 
                inputmode="decimal" 
                style="outline: none !important; border: none !important; box-shadow: none !important;"
                required
              >
            </div>
          </div>
        </div>

        <!-- Income Savings Allocation (Only shown when Income is selected) -->
        <div id="qa-savings-wrap" class="qa-field-group" style="display: ${currentSelectedType === 'income' ? 'block' : 'none'}; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.25rem;">
            <label class="form-label" style="margin: 0; font-weight: 700;">How much goes to savings?</label>
            <span id="qa-savings-badge" class="pill" style="font-size: 0.72rem; font-weight: 800; background: rgba(85, 168, 232, 0.12); color: var(--primary); padding: 0.1rem 0.5rem; border-radius: var(--radius-full);">
              ₱0 to savings
            </span>
          </div>
          <p style="font-size: 0.73rem; color: var(--text-muted); margin: 0 0 0.5rem 0; line-height: 1.35;">
            Choose if any of this added income goes to savings, or keep 100% in your spend budget.
          </p>

          <div class="qa-savings-presets" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; margin-bottom: 0.55rem;">
            <button type="button" class="qa-savings-pill active" data-preset="0">₱0 (0%)</button>
            <button type="button" class="qa-savings-pill" data-preset="rule">20% Rule</button>
            <button type="button" class="qa-savings-pill" data-preset="50">50%</button>
            <button type="button" class="qa-savings-pill" data-preset="custom">Custom</button>
          </div>

          <div id="qa-savings-custom-wrap" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-cloud); padding: 0.45rem 0.75rem; border-radius: var(--radius-md); border: 1.5px solid var(--border-color); gap: 0.5rem;">
            <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); white-space: nowrap;">Send to Savings:</span>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <span style="font-weight: 800; color: var(--text-muted); font-size: 0.88rem;">${curr}</span>
              <input type="number" id="qa-savings-amount" class="form-input" value="0" min="0" step="any" inputmode="decimal" style="height: 32px; width: 110px; text-align: right; font-weight: 800; border: 1.5px solid var(--border-color); background: var(--bg-card); padding: 0 0.5rem; font-size: 0.92rem; border-radius: 8px;" />
            </div>
          </div>

          <div id="qa-savings-impact-badge" style="margin-top: 0.45rem; font-size: 0.75rem; font-weight: 700; color: var(--mint-deep); background: rgba(156, 227, 192, 0.2); border: 1px solid rgba(156, 227, 192, 0.45); padding: 0.4rem 0.65rem; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 0.35rem;">
            ✨ <span id="qa-savings-impact-text">+₱0 to Spend Budget • ₱0 to Savings</span>
          </div>
        </div>

        <!-- Symmetrical 2-Column Categories (Clean Text, No Emojis) -->
        <div class="qa-cat-wrap">
          <label class="form-label" id="qa-cat-label">
            ${currentSelectedType === 'borrow' ? 'Minus from which envelope / budget cut:' : (currentSelectedType === 'income' ? 'Deposit Destination (Optional):' : 'Category')}
          </label>
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

        <!-- Balanced Full-Width Save / Update Button -->
        <button type="submit" class="qa-submit-btn squish-btn" id="qa-submit-btn">
          ${currentSelectedType === 'borrow' ? 'Save Hiram' : 'Save Transaction'}
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
      const borrowerWrap = backdrop.querySelector('#qa-borrower-wrap');
      if (borrowerWrap) borrowerWrap.style.display = nextType === 'borrow' ? 'block' : 'none';
      const savingsWrap = backdrop.querySelector('#qa-savings-wrap');
      if (savingsWrap) savingsWrap.style.display = nextType === 'income' ? 'block' : 'none';
      const submitBtn = backdrop.querySelector('#qa-submit-btn');
      if (submitBtn && !currentEditingTx) {
        submitBtn.textContent = nextType === 'borrow' ? 'Save Hiram' : 'Save Transaction';
      }
      renderCategoryChips(nextType, backdrop);
      updateSavingsCalculation(backdrop);
      updateBudgetValidation(backdrop);
    });
  });

  // Savings pill handlers
  const savingsPills = backdrop.querySelectorAll('.qa-savings-pill');
  const savingsAmountInput = backdrop.querySelector('#qa-savings-amount');
  savingsPills.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playPop();
      savingsPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      const amountVal = parseFloat(backdrop.querySelector('#qa-amount')?.value) || 0;
      const savingsRate = store.getSavingsRate();

      if (preset === '0') {
        if (savingsAmountInput) savingsAmountInput.value = '0';
      } else if (preset === 'rule') {
        if (savingsAmountInput) savingsAmountInput.value = String(Math.round(amountVal * savingsRate));
      } else if (preset === '50') {
        if (savingsAmountInput) savingsAmountInput.value = String(Math.round(amountVal * 0.5));
      } else if (preset === 'custom') {
        if (savingsAmountInput) savingsAmountInput.focus();
      }

      updateSavingsCalculation(backdrop);
    });
  });

  if (savingsAmountInput) {
    savingsAmountInput.addEventListener('input', () => {
      savingsPills.forEach(b => b.classList.toggle('active', b.dataset.preset === 'custom'));
      updateSavingsCalculation(backdrop);
    });
  }

  // Amount input event for real-time validation and savings calculation
  const amountInput = backdrop.querySelector('#qa-amount');
  amountInput.addEventListener('input', () => {
    const activePreset = backdrop.querySelector('.qa-savings-pill.active')?.dataset.preset;
    if (activePreset === '0') {
      if (savingsAmountInput) savingsAmountInput.value = '0';
    } else if (activePreset === 'rule') {
      const amt = parseFloat(amountInput.value) || 0;
      if (savingsAmountInput) savingsAmountInput.value = String(Math.round(amt * store.getSavingsRate()));
    } else if (activePreset === '50') {
      const amt = parseFloat(amountInput.value) || 0;
      if (savingsAmountInput) savingsAmountInput.value = String(Math.round(amt * 0.5));
    }
    updateSavingsCalculation(backdrop);
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
    const isBorrow = currentSelectedType === 'borrow';
    const borrowerVal = isBorrow ? (backdrop.querySelector('#qa-borrower')?.value || '').trim() : '';

    if (isBorrow && !borrowerVal && !currentEditingTx) {
      playPop();
      showToast({ text: "Please enter who borrowed the money (e.g. Ate Trish)", icon: "⚠️" });
      backdrop.querySelector('#qa-borrower')?.focus();
      return;
    }

    const noteRaw = backdrop.querySelector('#qa-note').value.trim();
    let note = noteRaw;
    let isLoan = isBorrow;
    let loanBorrower = borrowerVal;

    if (isBorrow) {
      loanBorrower = borrowerVal || (currentEditingTx?.borrowerName || 'Someone');
      note = `${loanBorrower} (hiram)` + (noteRaw ? ` - ${noteRaw}` : '');
    } else if (noteRaw && noteRaw.toLowerCase().includes('(hiram)')) {
      isLoan = true;
      loanBorrower = noteRaw.replace(/\(hiram\)/i, '').replace(/[-–]/g, '').trim() || 'Someone';
    }

    const isIncome = currentSelectedType === 'income';
    const selectedType = isIncome ? 'income' : 'expense';
    let savingsAmountVal = 0;
    if (isIncome) {
      const rawSavings = parseFloat(backdrop.querySelector('#qa-savings-amount')?.value) || 0;
      savingsAmountVal = Math.max(0, Math.min(amountVal, rawSavings));
    }
    const finalCategoryId = isIncome ? null : categoryId;
    const date = backdrop.querySelector('#qa-date').value;

    const txDate = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
    const cutoff = store.getCurrentCutoff(txDate);
    const summary = store.getCutoffSummary(cutoff);
    const currentCurr = store.getSettings().currency || '₱';

    // Strict validation
    if (selectedType === 'expense') {
      let effectiveRemaining = summary.remainingBudget;
      if (currentEditingTx && currentEditingTx.type === 'expense') {
        effectiveRemaining += (parseFloat(currentEditingTx.amount) || 0);
      }

      if (summary.budgetLimit <= 0 && !currentEditingTx) {
        playPop();
        showToast({ text: `Cannot log expense: No income logged yet for ${cutoff.label}. Please log income first.` });
        return;
      }

      if (finalCategoryId) {
        const catSpending = store.getCutoffCategorySpending(cutoff);
        const catSpend = catSpending.find(c => c.id === finalCategoryId);
        if (catSpend) {
          const isMisc = catSpend.id === 'cat-misc' || catSpend.name.toLowerCase().includes('misc');
          if (!isMisc) {
            let effectiveCatRem = catSpend.totalFunds - catSpend.spent;
            if (currentEditingTx && currentEditingTx.type === 'expense' && currentEditingTx.categoryId === finalCategoryId) {
              effectiveCatRem += (parseFloat(currentEditingTx.amount) || 0);
            }
            if (catSpend.totalFunds <= 0) {
              playPop();
              showToast({ text: `Cannot log: Envelope "${catSpend.name}" has no allocated budget for ${cutoff.label}. Set budget in Planner first.` });
              return;
            }
            if (amountVal > effectiveCatRem) {
              playPop();
              showToast({ text: `Cannot log: Exceeds "${catSpend.name}" budget! Only ${formatCurrency(Math.max(0, effectiveCatRem), currentCurr)} left.` });
              return;
            }
          }
        }
      }

      if (amountVal > effectiveRemaining) {
        playPop();
        showToast({ text: `Insufficient spend budget! Only ${formatCurrency(effectiveRemaining, currentCurr)} available.` });
        return;
      }
    }

    try {
      if (currentEditingTx) {
        // Update existing transaction
        const oldTx = { ...currentEditingTx };
        const updatedTx = store.updateTransaction(currentEditingTx.id, {
          type: selectedType,
          amount: amountVal,
          categoryId: finalCategoryId,
          note,
          date,
          ...(isIncome ? {
            savingsAmount: savingsAmountVal,
            isAddedIncome: true,
          } : {}),
          ...(isLoan ? {
            isLoan: true,
            borrowerName: loanBorrower,
            loanStatus: currentEditingTx.loanStatus || 'unpaid',
          } : {}),
        });

        playCoin();
        showToast({
          text: `Updated to ${selectedType === 'income' ? '+' : '-'}${formatCurrency(amountVal, currentCurr)}`,
          icon: 'check',
          onUndo: () => {
            store.updateTransaction(oldTx.id, oldTx);
            showToast({ text: 'Changes reverted' });
          },
        });

        closeQuickAddModal();
        return;
      }

      // Add new transaction
      const newTx = store.addTransaction({
        type: selectedType,
        amount: amountVal,
        categoryId: finalCategoryId,
        note,
        date,
        ...(isIncome ? {
          savingsAmount: savingsAmountVal,
          isAddedIncome: true,
        } : {}),
        ...(isLoan ? {
          isLoan: true,
          borrowerName: loanBorrower,
          loanStatus: 'unpaid',
        } : {}),
      });

      playCoin();
      if (selectedType === 'income' || amountVal >= 1000) {
        firePastelConfetti();
      }

      let toastText = `Saved ${selectedType === 'income' ? '+' : '-'}${formatCurrency(amountVal, currentCurr)}`;
      if (isLoan) {
        toastText = `Lent ${formatCurrency(amountVal, currentCurr)} to ${loanBorrower} (minused from budget) 🤝`;
      } else if (isIncome) {
        if (savingsAmountVal > 0) {
          toastText = `Added +${formatCurrency(amountVal, currentCurr)} (+${formatCurrency(amountVal - savingsAmountVal, currentCurr)} spend, ${formatCurrency(savingsAmountVal, currentCurr)} saved) 💰`;
        } else {
          toastText = `Added +${formatCurrency(amountVal, currentCurr)} to Base Salary (100% to spend budget) 💵`;
        }
      }

      showToast({
        text: toastText,
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

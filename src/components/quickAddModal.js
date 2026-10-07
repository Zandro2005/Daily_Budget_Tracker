// ====================================================================
// CLOUDY BUDGET - QUICK ADD MODAL (3-Tap Fast Logger)
// ====================================================================

import { store } from '../lib/store.js';
import { getTodayDateString } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from './toast.js';

let modalInstance = null;

export function openQuickAddModal(initialType = 'expense') {
  try {
    if (!modalInstance) {
      modalInstance = createModalDOM();
    }
    if (!document.body.contains(modalInstance)) {
      document.body.appendChild(modalInstance);
    }

    resetModalState(initialType);
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

function resetModalState(type = 'expense') {
  if (!modalInstance) return;
  const form = modalInstance.querySelector('#qa-form');
  if (form) form.reset();

  const typeInputs = modalInstance.querySelectorAll('input[name="qa-type"]');
  typeInputs.forEach(i => (i.checked = i.value === type));

  const dateInput = modalInstance.querySelector('#qa-date');
  if (dateInput) dateInput.value = getTodayDateString();

  renderCategoryChips(type, modalInstance);
}

function renderCategoryChips(type, root = modalInstance) {
  if (!root) return;
  const container = root.querySelector('#qa-category-grid');
  if (!container) return;
  container.innerHTML = '';

  const categories = store.getCategories();
  // Filter appropriate categories (e.g. if income, show income first)
  const filtered = type === 'income' 
    ? categories.filter(c => c.name.toLowerCase().includes('income') || c.monthly_limit === 0)
    : categories.filter(c => !c.name.toLowerCase().includes('income'));

  const displayList = filtered.length > 0 ? filtered : categories;

  displayList.forEach((cat, index) => {
    const chip = document.createElement('div');
    chip.className = `cat-chip ${index === 0 ? 'selected' : ''}`;
    chip.dataset.id = cat.id;
    chip.innerHTML = `
      <span class="cat-emoji">${cat.emoji}</span>
      <span class="cat-name">${cat.name.split(' ')[0]}</span>
    `;

    chip.addEventListener('click', () => {
      playPop();
      container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });

    container.appendChild(chip);
  });
}

function createModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  modalInstance = backdrop;

  backdrop.innerHTML = `
    <div class="modal-dialog" style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 16px));">
      <div class="modal-header" style="justify-content: center; position: relative; margin-bottom: 0.75rem;">
        <h3 class="modal-title" style="font-size: 1.1rem;">Quick Add</h3>
        <button class="modal-close" id="qa-close-btn" style="position: absolute; right: 0;">&times;</button>
      </div>

      <!-- Type Switcher -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; background: var(--bg-input); padding: 4px; border-radius: var(--radius-full);">
        <label style="flex: 1; text-align: center; cursor: pointer;">
          <input type="radio" name="qa-type" value="expense" checked style="display: none;">
          <div class="type-pill-btn active-expense" id="pill-expense" style="padding: 0.4rem; border-radius: var(--radius-full); font-weight: 700; font-size: 0.85rem; transition: all 0.2s; user-select: none;">
            💸 Expense
          </div>
        </label>
        <label style="flex: 1; text-align: center; cursor: pointer;">
          <input type="radio" name="qa-type" value="income" style="display: none;">
          <div class="type-pill-btn" id="pill-income" style="padding: 0.4rem; border-radius: var(--radius-full); font-weight: 700; font-size: 0.85rem; transition: all 0.2s; user-select: none;">
            💰 Income
          </div>
        </label>
      </div>

      <form id="qa-form">
        <!-- Amount Input -->
        <div class="form-group" style="margin-bottom: 0.55rem; text-align: center;">
          <input 
            type="number" 
            id="qa-amount" 
            class="form-input" 
            placeholder="0.00" 
            step="any" 
            inputmode="decimal"
            required
            style="font-size: 1.55rem; font-weight: 800; font-family: var(--font-display); text-align: center; padding: 0.4rem; height: 46px;"
          >
        </div>

        <!-- Quick Amount Presets -->
        <div class="quick-amount-presets" style="display: flex; justify-content: center; margin-bottom: 0.6rem; gap: 0.3rem; flex-wrap: nowrap;">
          <button type="button" class="preset-chip" data-add="50" style="padding: 0.22rem 0.55rem; font-size: 0.76rem;">+50</button>
          <button type="button" class="preset-chip" data-add="100" style="padding: 0.22rem 0.55rem; font-size: 0.76rem;">+100</button>
          <button type="button" class="preset-chip" data-add="200" style="padding: 0.22rem 0.55rem; font-size: 0.76rem;">+200</button>
          <button type="button" class="preset-chip" data-add="500" style="padding: 0.22rem 0.55rem; font-size: 0.76rem;">+500</button>
          <button type="button" class="preset-chip" data-add="1000" style="padding: 0.22rem 0.55rem; font-size: 0.76rem;">+1k</button>
        </div>

        <!-- Category Grid -->
        <div class="form-group" style="margin-bottom: 0.55rem;">
          <div id="qa-category-grid" class="category-grid"></div>
        </div>

        <!-- Note & Date -->
        <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.45rem; margin-bottom: 0.7rem;">
          <input type="text" id="qa-note" class="form-input" style="padding: 0.42rem 0.6rem; font-size: 0.84rem;" placeholder="Note (optional)">
          <input type="date" id="qa-date" class="form-input" style="padding: 0.42rem 0.45rem; font-size: 0.8rem;" value="${getTodayDateString()}">
        </div>

        <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.7rem; font-size: 0.95rem; touch-action: manipulation;">
          Save ✨
        </button>
      </form>
    </div>
  `;

  // Auto-scroll input into view when virtual keyboard pops up
  backdrop.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 350);
    });
  });

  // Close handlers
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeQuickAddModal();
  });
  backdrop.querySelector('#qa-close-btn').addEventListener('click', closeQuickAddModal);

  // Type switcher UI update
  const typeRadios = backdrop.querySelectorAll('input[name="qa-type"]');
  const pillExpense = backdrop.querySelector('#pill-expense');
  const pillIncome = backdrop.querySelector('#pill-income');

  function updateTypeUI(val) {
    if (val === 'expense') {
      pillExpense.style.background = 'var(--coral-alert)';
      pillExpense.style.color = '#FFF';
      pillIncome.style.background = 'transparent';
      pillIncome.style.color = 'var(--text-muted)';
    } else {
      pillIncome.style.background = 'var(--mint-deep)';
      pillIncome.style.color = '#FFF';
      pillExpense.style.background = 'transparent';
      pillExpense.style.color = 'var(--text-muted)';
    }
    renderCategoryChips(val, backdrop);
  }

  typeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      playPop();
      updateTypeUI(radio.value);
    });
  });
  updateTypeUI('expense');

  // Preset chips logic
  backdrop.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      playPop();
      const amountInput = backdrop.querySelector('#qa-amount');
      const addVal = parseFloat(btn.dataset.add) || 0;
      const current = parseFloat(amountInput.value) || 0;
      amountInput.value = (current + addVal).toString();
      amountInput.focus();
    });
  });

  // Form submit
  backdrop.querySelector('#qa-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amountVal = parseFloat(backdrop.querySelector('#qa-amount').value);
    if (!amountVal || amountVal <= 0) return;

    const selectedType = backdrop.querySelector('input[name="qa-type"]:checked').value;
    const selectedCatEl = backdrop.querySelector('.cat-chip.selected');
    const categoryId = selectedCatEl ? selectedCatEl.dataset.id : null;
    const note = backdrop.querySelector('#qa-note').value;
    const date = backdrop.querySelector('#qa-date').value;

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

    const curr = store.getSettings().currency;
    showToast({
      text: `Saved ${selectedType === 'income' ? '+' : '-'}${curr}${amountVal.toLocaleString()}! ☁️`,
      icon: selectedType === 'income' ? '🎉' : '✨',
      onUndo: () => {
        store.deleteTransaction(newTx.id);
        showToast({ text: 'Record removed! ↩️' });
      },
    });

    closeQuickAddModal();
  });

  return backdrop;
}

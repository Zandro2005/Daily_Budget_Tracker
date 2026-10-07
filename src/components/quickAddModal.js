// ====================================================================
// LYKA WALLET - SIMPLE QUICK ADD MODAL
// Clean, elegant logger with no emojis on choices & contained width
// ====================================================================

import { store } from '../lib/store.js';
import { getTodayDateString } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from './toast.js';

let modalInstance = null;
let currentSelectedType = 'expense';

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
  currentSelectedType = type;
  const form = modalInstance.querySelector('#qa-form');
  if (form) form.reset();

  const typeButtons = modalInstance.querySelectorAll('.qa-type-btn');
  typeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const dateInput = modalInstance.querySelector('#qa-date');
  if (dateInput) dateInput.value = getTodayDateString();

  renderCategoryChips(type, modalInstance);
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
    // Clean text name without emoji
    pill.textContent = cat.name;

    pill.addEventListener('click', (e) => {
      e.preventDefault();
      playPop();
      container.querySelectorAll('.qa-cat-pill').forEach(c => c.classList.remove('selected'));
      pill.classList.add('selected');
    });

    container.appendChild(pill);
  });
}

function createModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  modalInstance = backdrop;

  const curr = store.getSettings().currency || '₱';

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 class="modal-title" style="font-size: 1.15rem; font-weight: 700; margin: 0;">Add Transaction</h3>
        <button class="modal-close" id="qa-close-btn" type="button" aria-label="Close">&times;</button>
      </div>

      <!-- Clean Type Switcher (No Emojis) -->
      <div class="qa-type-toggle">
        <button type="button" class="qa-type-btn ${currentSelectedType === 'expense' ? 'active' : ''}" data-type="expense">
          Expense
        </button>
        <button type="button" class="qa-type-btn ${currentSelectedType === 'income' ? 'active' : ''}" data-type="income">
          Income
        </button>
      </div>

      <form id="qa-form">
        <!-- Clean Amount Input -->
        <div class="qa-amount-wrap">
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

        <!-- Clean Category Choices (Text Pills, No Emojis) -->
        <div class="qa-cat-wrap">
          <label class="form-label">Category</label>
          <div id="qa-category-list" class="qa-cat-list"></div>
        </div>

        <!-- Note & Date (Contained & Simple) -->
        <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 0.5rem; margin-bottom: 1.15rem;">
          <div>
            <label class="form-label">Note (optional)</label>
            <input type="text" id="qa-note" class="form-input" placeholder="e.g. Groceries">
          </div>
          <div>
            <label class="form-label">Date</label>
            <input type="date" id="qa-date" class="form-input" value="${getTodayDateString()}">
          </div>
        </div>

        <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.75rem; font-size: 0.95rem;">
          Save
        </button>
      </form>
    </div>
  `;

  // Auto-scroll input into view on virtual keyboard focus
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
    });
  });

  // Form submit
  backdrop.querySelector('#qa-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amountVal = parseFloat(backdrop.querySelector('#qa-amount').value);
    if (!amountVal || amountVal <= 0) return;

    const selectedType = currentSelectedType;
    const selectedCatEl = backdrop.querySelector('.qa-cat-pill.selected');
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

    const currentCurr = store.getSettings().currency || '₱';
    showToast({
      text: `Saved ${selectedType === 'income' ? '+' : '-'}${currentCurr}${amountVal.toLocaleString()}! ☁️`,
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

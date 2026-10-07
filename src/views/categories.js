// ====================================================================
// CLOUDY BUDGET - CATEGORIES & BUDGET ALLOCATIONS VIEW
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { showToast } from '../components/toast.js';

export function renderCategories() {
  const container = document.createElement('div');
  container.className = 'categories-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const catSpendings = store.getCategorySpending();
    const allCategories = store.getCategories();

    // Header & Add Category Button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;';
    header.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem;">
          <span>🗂️</span> Category Cloud Budgets
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
          Assign monthly limits to keep your treats in check
        </p>
      </div>
      <button class="btn btn-primary squish-btn" id="open-new-cat-btn">
        <span>🌸</span> New Category
      </button>
    `;

    header.querySelector('#open-new-cat-btn').onclick = () => {
      playPop();
      openCategoryModal();
    };
    container.appendChild(header);

    // Categories Grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;';

    catSpendings.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'cloud-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '0.75rem';

      const isOver = cat.monthly_limit > 0 && cat.spent > cat.monthly_limit;
      const statusClass = isOver ? 'status-danger' : cat.percent >= 75 ? 'status-warn' : 'status-safe';

      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-full); background: ${cat.color || 'var(--sky-100)'}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
              ${cat.emoji}
            </div>
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 700;">${cat.name}</h4>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                ${cat.monthly_limit > 0 ? `Limit: ${formatCurrency(cat.monthly_limit, curr)}` : 'No monthly limit'}
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="icon-btn edit-cat-btn" data-id="${cat.id}" style="width: 32px; height: 32px; font-size: 0.85rem;" title="Edit limit">✏️</button>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.35rem;">
            <span>Spent: ${formatCurrency(cat.spent, curr)}</span>
            <span style="color: ${isOver ? 'var(--coral-alert)' : 'var(--text-muted)'};">
              ${cat.monthly_limit > 0 ? `${Math.round(cat.percent)}% used` : ''}
            </span>
          </div>
          <div class="cloud-progress">
            <div class="cloud-progress-fill ${statusClass}" style="width: ${Math.min(100, Math.round(cat.percent))}%;"></div>
          </div>
          ${
            cat.monthly_limit > 0
              ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.4rem; font-weight: 600;">
                  ${isOver ? `⚠️ Over limit by ${formatCurrency(cat.spent - cat.monthly_limit, curr)}` : `☁️ ${formatCurrency(cat.remaining, curr)} remaining`}
                </div>`
              : ''
          }
        </div>
      `;

      card.querySelector('.edit-cat-btn').onclick = () => {
        playPop();
        openCategoryModal(cat);
      };

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // Modal to Add / Edit Category
  function openCategoryModal(existingCat = null) {
    const isEdit = Boolean(existingCat);
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop open';

    const emojis = ['🍱', '🧋', '🚌', '⚡', '🛍️', '🌸', '🎮', '💊', '📚', '☕', '🎂', '🏖️', '🐾', '💄', '🛒'];
    let selectedEmoji = existingCat ? existingCat.emoji : '🌸';

    modalBackdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title"><span>${isEdit ? '✏️ Edit' : '🌸 Add'} Category</span></h3>
          <button class="modal-close" id="cat-modal-close">&times;</button>
        </div>
        <form id="cat-form">
          <div class="form-group">
            <label class="form-label">Category Name</label>
            <input type="text" id="cat-name-input" class="form-input" required value="${existingCat ? existingCat.name : ''}" placeholder="e.g. Skin Care, Boba Fund...">
          </div>

          <div class="form-group">
            <label class="form-label">Pick an Emoji</label>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.35rem;">
              ${emojis.map(e => `
                <button type="button" class="icon-btn emoji-select-btn ${e === selectedEmoji ? 'active' : ''}" data-emoji="${e}" style="width: 38px; height: 38px; font-size: 1.25rem;">
                  ${e}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Monthly Budget Cap (${store.getSettings().currency})</label>
            <input type="number" id="cat-limit-input" class="form-input" placeholder="0 = No limit" value="${existingCat ? existingCat.monthly_limit || 0 : 3000}">
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
            ${isEdit && !existingCat.id.startsWith('cat-income') ? `
              <button type="button" class="btn btn-danger squish-btn" id="cat-delete-btn" style="flex: 1;">
                Delete
              </button>
            ` : ''}
            <button type="submit" class="btn btn-primary squish-btn" style="flex: 2;">
              Save Category
            </button>
          </div>
        </form>
      </div>
    `;

    const close = () => {
      modalBackdrop.classList.remove('open');
      setTimeout(() => modalBackdrop.remove(), 250);
    };

    modalBackdrop.querySelector('#cat-modal-close').onclick = close;
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) close();
    });

    modalBackdrop.querySelectorAll('.emoji-select-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        selectedEmoji = btn.dataset.emoji;
        modalBackdrop.querySelectorAll('.emoji-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    if (modalBackdrop.querySelector('#cat-delete-btn')) {
      modalBackdrop.querySelector('#cat-delete-btn').onclick = () => {
        if (confirm(`Delete category "${existingCat.name}"?`)) {
          store.deleteCategory(existingCat.id);
          showToast({ text: 'Category deleted! 🗑️' });
          close();
          renderContent();
        }
      };
    }

    modalBackdrop.querySelector('#cat-form').onsubmit = (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#cat-name-input').value;
      const limit = parseFloat(modalBackdrop.querySelector('#cat-limit-input').value) || 0;

      if (isEdit) {
        store.updateCategory(existingCat.id, {
          name,
          emoji: selectedEmoji,
          monthly_limit: limit,
        });
        showToast({ text: 'Category updated! ✨' });
      } else {
        store.addCategory({
          name,
          emoji: selectedEmoji,
          monthly_limit: limit,
        });
        showToast({ text: 'New category added! 🌸' });
      }
      playCoin();
      close();
      renderContent();
    };

    document.body.appendChild(modalBackdrop);
  }

  renderContent();
  return container;
}

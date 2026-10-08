// ====================================================================
// CLOUDY BUDGET - ENVELOPES & ALLOCATIONS VIEW
// Redesigned to look like a desktop folder/envelope interface!
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency } from '../lib/format.js';
import { playPop, playCoin } from '../lib/audio.js';
import { showToast } from '../components/toast.js';
import { ICONS } from '../lib/icons.js';

export function renderCategories() {
  const container = document.createElement('div');
  container.className = 'categories-view anim-fade-in';
  container.style.paddingBottom = '5rem';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const catSpendings = store.getCategorySpending();
    
    // Header & Add Category Button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.75rem;';
    header.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 0.45rem; margin: 0; color: var(--text-main);">
          My Envelopes
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin: 0.2rem 0 0 0;">
          Tap an envelope to set its monthly limit
        </p>
      </div>
      <button class="btn btn-primary squish-btn" id="open-new-cat-btn" style="padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-full);">
        Add
      </button>
    `;

    header.querySelector('#open-new-cat-btn').onclick = () => {
      playPop();
      openCategoryModal();
    };
    container.appendChild(header);

    // Envelopes Grid (Windows Folder Style)
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1.25rem 0.75rem; justify-items: center;';

    catSpendings.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'folder-item squish-btn';
      card.style.cssText = 'width: 100%; max-width: 145px; text-align: center;';

      const isOver = cat.monthly_limit > 0 && cat.spent > cat.monthly_limit;
      const statusClass = isOver ? 'status-danger' : cat.percent >= 75 ? 'status-warn' : 'status-safe';
      const safeId = String(cat.id || cat.name).replace(/[^a-zA-Z0-9_-]/g, '_');

      const folderSvg = `
        <svg viewBox="0 0 100 86" width="84" height="72" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(220, 160, 20, 0.28));">
          <defs>
            <linearGradient id="cat_wfBackGrad_${safeId}" x1="20" y1="10" x2="80" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFD65C"/>
              <stop offset="100%" stop-color="#EAA615"/>
            </linearGradient>
            <linearGradient id="cat_wfFrontGrad_${safeId}" x1="15" y1="26" x2="85" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFE785"/>
              <stop offset="40%" stop-color="#FED049"/>
              <stop offset="100%" stop-color="#F3AE1A"/>
            </linearGradient>
            <linearGradient id="cat_wfSpineGrad_${safeId}" x1="10" y1="26" x2="20" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#F7BE2F"/>
              <stop offset="100%" stop-color="#D9940A"/>
            </linearGradient>
          </defs>
          
          <path d="M 18 12 C 18 10 19.5 8.5 21.5 8.5 L 43 8.5 C 45 8.5 46.5 9.5 47.5 11 L 52 17 L 85 17 C 87.5 17 89 18.5 89 21 L 89 65 C 89 67 87.5 68.5 85 68.5 L 21.5 68.5 C 19.5 68.5 18 67 18 65 Z" fill="url(#cat_wfBackGrad_${safeId})"/>
          <rect x="25" y="16" width="56" height="36" rx="2" fill="#FFFFFF" fill-opacity="0.95"/>
          <rect x="30" y="22" width="34" height="2.5" rx="1.25" fill="#CBD5E1"/>
          <rect x="30" y="27" width="44" height="2.5" rx="1.25" fill="#E2E8F0"/>
          <rect x="30" y="32" width="24" height="2.5" rx="1.25" fill="#E2E8F0"/>
          <path d="M 14 30 L 22 24 L 22 72 L 14 78 Z" fill="url(#cat_wfSpineGrad_${safeId})"/>
          <path d="M 22 24 C 22 22.5 23.5 21.5 25 21.5 L 89 21.5 C 91 21.5 92.5 22.8 92.8 24.8 L 97 68 C 97.2 70.2 95.5 72 93.3 72 L 23 72 C 21.5 72 20.5 71 20.5 69.5 L 22 24 Z" fill="url(#cat_wfFrontGrad_${safeId})"/>
          <path d="M 23 23 L 89 23" stroke="#FFF7C2" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;

      card.innerHTML = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-bottom: 0.3rem;">
          ${folderSvg}
          ${isOver ? `<div style="position: absolute; top: -2px; right: 8px; background: var(--coral-alert); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.72rem; box-shadow: 0 2px 6px rgba(255,100,100,0.4); border: 2px solid white;">!</div>` : ''}
        </div>
        <div style="font-weight: 800; font-family: var(--font-display); font-size: 0.88rem; color: var(--text-main); line-height: 1.15; word-break: break-word; max-width: 120px; text-align: center; margin-bottom: 0.2rem;">
          ${cat.name}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-align: center;">
          ${cat.monthly_limit > 0 ? `${formatCurrency(cat.remaining, curr)} left` : 'No limit'}
        </div>
        
        ${cat.monthly_limit > 0 ? `
        <div class="cloud-progress" style="height: 4px; width: 62px; margin-top: 0.25rem; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
          <div class="cloud-progress-fill ${statusClass}" style="width: ${Math.min(100, Math.round(cat.percent))}%;"></div>
        </div>
        ` : ''}
      `;

      card.onclick = () => {
        playPop();
        openCategoryModal(cat);
      };

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // Modal to Add / Edit Envelope
  function openCategoryModal(existingCat = null) {
    const isEdit = Boolean(existingCat);
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop open';

    modalBackdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Allocate: ' + existingCat.name : 'New Envelope'}</h3>
          <button class="modal-close" id="cat-modal-close">&times;</button>
        </div>
        <form id="cat-form">
          <div class="form-group">
            <label class="form-label">Envelope Name</label>
            <input type="text" id="cat-name-input" class="form-input" required value="${existingCat ? existingCat.name : ''}" placeholder="e.g. Bills, Shopping, Daily...">
          </div>

          <div class="form-group">
            <label class="form-label">Allocated Monthly Budget (${store.getSettings().currency})</label>
            <input type="number" id="cat-limit-input" class="form-input" placeholder="0 = No budget" value="${existingCat ? existingCat.monthly_limit || 0 : 3000}">
          </div>
          
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.5rem;">
            Tip: Setting an allocation for the <strong>"Cutoff Allowance"</strong> envelope sets your Daily Tracker base value!
          </div>

          <div style="display: flex; gap: 0.5rem;">
            ${isEdit && !existingCat.id.startsWith('cat-income') && existingCat.id !== 'cat-daily' ? `
              <button type="button" class="btn btn-danger squish-btn" id="cat-delete-btn" style="flex: 1;">
                Delete
              </button>
            ` : ''}
            <button type="submit" class="btn btn-primary squish-btn" style="flex: 2;">
              Save Allocation
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

    if (modalBackdrop.querySelector('#cat-delete-btn')) {
      modalBackdrop.querySelector('#cat-delete-btn').onclick = () => {
        if (confirm(`Delete envelope "${existingCat.name}"?`)) {
          store.deleteCategory(existingCat.id);
          showToast({ text: 'Envelope deleted' });
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
          monthly_limit: limit,
        });
        showToast({ text: 'Envelope updated', icon: 'check' });
      } else {
        store.addCategory({
          name,
          monthly_limit: limit,
        });
        showToast({ text: 'New envelope added', icon: 'check' });
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

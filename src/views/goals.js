// ====================================================================
// CLOUDY BUDGET - SAVINGS GOALS VIEW
// Interactive jar/cloud goals with confetti celebrations
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { playPop, playSuccess, playCoin } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from '../components/toast.js';

export function renderGoals() {
  const container = document.createElement('div');
  container.className = 'goals-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const goalsList = store.getGoals();

    // Header & Add Goal Button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;';
    header.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem;">
          <span>🎯</span> Dream Savings Goals
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
          Save up for travel, emergency funds, or sweet treats
        </p>
      </div>
      <button class="btn btn-primary squish-btn" id="open-new-goal-btn">
        <span>🌟</span> New Goal
      </button>
    `;

    header.querySelector('#open-new-goal-btn').onclick = () => {
      playPop();
      openNewGoalModal();
    };
    container.appendChild(header);

    // Goals Grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 1.25rem;';

    if (goalsList.length === 0) {
      grid.innerHTML = `
        <div class="cloud-card" style="text-align: center; padding: 3rem 1.5rem; grid-column: 1 / -1;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🌸</div>
          <h3 style="font-family: var(--font-display); font-size: 1.25rem;">No savings goals yet</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 0.25rem;">Start small! Even ₱500 a week brings big dreams to life.</p>
        </div>
      `;
    } else {
      goalsList.forEach(goal => {
        const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
        const isDone = goal.currentAmount >= goal.targetAmount;

        const card = document.createElement('div');
        card.className = 'cloud-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.9rem';

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 48px; height: 48px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">
                ${goal.emoji}
              </div>
              <div>
                <h4 style="font-size: 1.1rem; font-weight: 700;">${goal.name}</h4>
                <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
                  Target: ${formatCurrency(goal.targetAmount, curr)} ${goal.deadline ? `&bull; By ${formatDate(goal.deadline)}` : ''}
                </span>
              </div>
            </div>
            ${
              isDone
                ? '<span class="pill" style="background: var(--mint-green); color: #1E293B;">👑 Complete!</span>'
                : `<span class="pill">${percent}%</span>`
            }
          </div>

          <!-- Progress Bar -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem;">
              <span style="color: var(--text-muted);">Saved so far:</span>
              <span style="color: var(--mint-deep);">${formatCurrency(goal.currentAmount, curr)}</span>
            </div>
            <div class="cloud-progress" style="height: 14px;">
              <div class="cloud-progress-fill ${isDone ? 'status-safe' : 'status-warn'}" style="width: ${percent}%;"></div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            <button class="btn btn-secondary btn-sm squish-btn add-savings-btn" data-id="${goal.id}" style="flex: 1;">
              <span>🌱</span> Add Money
            </button>
            <button class="icon-btn delete-goal-btn" data-id="${goal.id}" title="Delete goal" style="width: 34px; height: 34px; font-size: 0.85rem; color: var(--danger);">
              🗑️
            </button>
          </div>
        `;

        card.querySelector('.add-savings-btn').onclick = () => {
          playPop();
          openContributeModal(goal);
        };

        card.querySelector('.delete-goal-btn').onclick = () => {
          if (confirm(`Remove savings goal "${goal.name}"?`)) {
            store.deleteGoal(goal.id);
            showToast({ text: 'Goal deleted! 🗑️' });
            renderContent();
          }
        };

        grid.appendChild(card);
      });
    }

    container.appendChild(grid);
  }

  function openNewGoalModal() {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop open';

    const emojis = ['✈️', '🛡️', '💻', '🎵', '🏠', '🚗', '💍', '🎁', '🐶', '👗', '🎮'];
    let selectedEmoji = '✈️';

    modalBackdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title"><span>🌟 New Savings Goal</span></h3>
          <button class="modal-close" id="new-goal-close">&times;</button>
        </div>
        <form id="new-goal-form">
          <div class="form-group">
            <label class="form-label">Goal Name</label>
            <input type="text" id="g-name" class="form-input" required placeholder="e.g. Kyoto Trip, New Tablet, Rainy Day">
          </div>
          <div class="form-group">
            <label class="form-label">Pick an Emoji Icon</label>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.35rem;">
              ${emojis.map(e => `
                <button type="button" class="icon-btn goal-emoji-btn ${e === selectedEmoji ? 'active' : ''}" data-emoji="${e}" style="width: 38px; height: 38px; font-size: 1.25rem;">
                  ${e}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Target Amount (${store.getSettings().currency})</label>
            <input type="number" id="g-target" class="form-input" required step="any" placeholder="50000">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Saved Amount (optional)</label>
            <input type="number" id="g-initial" class="form-input" step="any" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Target Date (optional)</label>
            <input type="date" id="g-date" class="form-input">
          </div>
          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; margin-top: 1rem; padding: 0.85rem;">
            Create Savings Goal
          </button>
        </form>
      </div>
    `;

    const close = () => {
      modalBackdrop.classList.remove('open');
      setTimeout(() => modalBackdrop.remove(), 250);
    };

    modalBackdrop.querySelector('#new-goal-close').onclick = close;
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) close();
    });

    modalBackdrop.querySelectorAll('.goal-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        playPop();
        selectedEmoji = btn.dataset.emoji;
        modalBackdrop.querySelectorAll('.goal-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    modalBackdrop.querySelector('#new-goal-form').onsubmit = (e) => {
      e.preventDefault();
      const name = modalBackdrop.querySelector('#g-name').value;
      const targetAmount = parseFloat(modalBackdrop.querySelector('#g-target').value);
      const initial = parseFloat(modalBackdrop.querySelector('#g-initial').value) || 0;
      const deadline = modalBackdrop.querySelector('#g-date').value;

      if (!targetAmount || targetAmount <= 0) return;

      store.addGoal({
        name,
        targetAmount,
        currentAmount: initial,
        emoji: selectedEmoji,
        deadline,
      });

      playCoin();
      showToast({ text: `Goal "${name}" created! 🌸`, icon: '✨' });
      close();
      renderContent();
    };

    document.body.appendChild(modalBackdrop);
  }

  function openContributeModal(goal) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop open';
    const curr = store.getSettings().currency;

    modalBackdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title"><span>🌱 Add to ${goal.name}</span></h3>
          <button class="modal-close" id="contrib-close">&times;</button>
        </div>
        <form id="contrib-form">
          <div class="form-group">
            <label class="form-label">How much would you like to add?</label>
            <input type="number" id="contrib-amount" class="form-input" style="font-size: 1.5rem; font-weight: 700;" required step="any" placeholder="0.00">
          </div>
          <div class="quick-amount-presets" style="margin-bottom: 1.25rem;">
            <button type="button" class="preset-chip" data-val="500">+500</button>
            <button type="button" class="preset-chip" data-val="1000">+1,000</button>
            <button type="button" class="preset-chip" data-val="2500">+2,500</button>
            <button type="button" class="preset-chip" data-val="5000">+5,000</button>
          </div>
          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.85rem;">
            Add to Goal ✨
          </button>
        </form>
      </div>
    `;

    const close = () => {
      modalBackdrop.classList.remove('open');
      setTimeout(() => modalBackdrop.remove(), 250);
    };

    modalBackdrop.querySelector('#contrib-close').onclick = close;
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) close();
    });

    modalBackdrop.querySelectorAll('.preset-chip').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const amtInput = modalBackdrop.querySelector('#contrib-amount');
        amtInput.value = btn.dataset.val;
      };
    });

    modalBackdrop.querySelector('#contrib-form').onsubmit = (e) => {
      e.preventDefault();
      const addVal = parseFloat(modalBackdrop.querySelector('#contrib-amount').value);
      if (!addVal || addVal <= 0) return;

      const updated = store.contributeToGoal(goal.id, addVal);

      if (updated && updated.isCompleted) {
        playSuccess();
        firePastelConfetti();
        showToast({ text: `🎉 CONGRATS! You reached your goal for "${goal.name}"! 👑`, icon: '🌟' });
      } else {
        playCoin();
        showToast({ text: `Added ${curr}${addVal.toLocaleString()} to ${goal.name}! 🌱`, icon: '✨' });
      }

      close();
      renderContent();
    };

    document.body.appendChild(modalBackdrop);
  }

  renderContent();
  return container;
}

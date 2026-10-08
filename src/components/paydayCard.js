// ====================================================================
// LYKA WALLET - PAYDAY ALERT & CONFIRMATION CARD
// Sleek, minimal salary logger with emerald-yellow styling & zero emojis
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency } from '../lib/format.js';
import { playCoin, playSuccess, playPop } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from './toast.js';
import { ICONS } from '../lib/icons.js';

let isDismissedForSession = false;

export function resetPaydayDismissal() {
  isDismissedForSession = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('lyka:reset-payday-dismissal', () => {
    isDismissedForSession = false;
  });
}

export function renderPaydayCard() {
  if (isDismissedForSession) return null;

  const pending = store.getPendingPayday();
  if (!pending) return null;

  const settings = store.getSettings();
  const curr = settings.currency || '₱';
  const cutoff = pending.cutoff;
  const prev = pending.previous;
  const goals = store.getGoals();

  const card = document.createElement('div');
  card.className = 'cloud-card payday-banner anim-fade-in';
  card.style.cssText = `
    margin-bottom: 1rem;
    padding: 0.9rem 1.1rem;
    background: linear-gradient(135deg, rgba(255, 248, 230, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
    border: 1.5px solid #FFD666;
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 16px -2px rgba(230, 168, 0, 0.18);
    position: relative;
    animation: modalPopIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
  `;

  const hasLeftover = prev && prev.leftover > 0;
  const isPayday = pending.isPayday;

  card.innerHTML = `
    <!-- Top Header: Title & Dismiss -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
      <div style="display: flex; align-items: center; gap: 0.45rem;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius-full); background: #FFF9E6; border: 1.5px solid #FFE58F; color: #D48806;">
          ${ICONS.wallet}
        </span>
        <div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span style="font-size: 0.7rem; font-weight: 800; color: #B38300; text-transform: uppercase; letter-spacing: 0.05em;">
              ${isPayday ? 'Payday Ready' : 'Income Reminder'}
            </span>
            <span class="pill" style="font-size: 0.68rem; font-weight: 800; background: #FFF9E6; border: 1px solid #FFE58F; color: #8C6D00; padding: 0.08rem 0.45rem; border-radius: var(--radius-full);">
              ${cutoff.label}
            </span>
          </div>
          <h4 style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 800; margin: 0; color: var(--text-main);">
            ${isPayday ? 'Confirm Paycheck' : 'Log Cutoff Income'}
          </h4>
        </div>
      </div>
      <button id="payday-dismiss-btn" class="icon-btn" title="Dismiss" style="width: 26px; height: 26px; border-radius: var(--radius-full); background: transparent; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; line-height: 1;">
        &times;
      </button>
    </div>

    <!-- Compact Salary Row (Emerald & Yellow) -->
    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.95); padding: 0.5rem 0.85rem; border-radius: var(--radius-md); border: 1.5px solid #FFE58F; margin-bottom: 0.75rem;">
      <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); white-space: nowrap;">
        Paycheck Amount
      </span>
      <div style="display: flex; align-items: center; gap: 0.35rem;">
        <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; color: var(--mint-deep);">${curr}</span>
        <input 
          type="number" 
          id="payday-amount-input" 
          class="form-input" 
          value="${pending.salary > 0 ? pending.salary : ''}" 
          placeholder="0.00"
          step="any"
          inputmode="decimal"
          style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; padding: 0.2rem 0.35rem; width: 125px; text-align: right; border: none; background: transparent; color: var(--mint-deep); outline: none; -webkit-appearance: none; -moz-appearance: textfield; appearance: none; margin: 0;"
        >
      </div>
    </div>

    ${hasLeftover ? `
      <!-- Minimal Leftover Rollover Section (Remaining Money Goes to Savings) -->
      <div style="background: rgba(255, 251, 230, 0.95); padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); border: 1px dashed #FFD666; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; font-size: 0.75rem;">
          <span style="color: #8C6D00; font-weight: 700;">Remaining from last cutoff:</span>
          <strong style="color: var(--mint-deep); font-family: var(--font-display); font-size: 0.92rem;">${formatCurrency(prev.leftover, curr)}</strong>
        </div>
        <div style="font-size: 0.72rem; color: #8C6D00; margin-bottom: 0.45rem; line-height: 1.35;">
          Unspent money will automatically go to your savings:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.45rem;">
          <label style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.42rem; background: #FFF; border-radius: var(--radius-sm); border: 1.5px solid #FFD666; font-size: 0.74rem; font-weight: 700; cursor: pointer; color: #8C6D00;">
            <input type="radio" name="leftover-action" value="save" checked style="accent-color: #FAAD14;">
            <span>Go to Savings</span>
          </label>
          <label style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.42rem; background: #FFF; border-radius: var(--radius-sm); border: 1px solid #FFE58F; font-size: 0.74rem; font-weight: 700; cursor: pointer; color: var(--text-muted);">
            <input type="radio" name="leftover-action" value="carry" style="accent-color: #FAAD14;">
            <span>Carry Over</span>
          </label>
        </div>

        <div id="leftover-goal-picker" style="margin-top: 0.45rem;">
          <label style="display: block; font-size: 0.7rem; font-weight: 700; color: #8C6D00; margin-bottom: 0.2rem;">Deposit into:</label>
          <select id="leftover-goal-select" class="form-select" style="font-size: 0.75rem; padding: 0.35rem 0.55rem; width: 100%; border-color: #FFD666; background: #FFF;">
            ${goals.length === 0 ? '<option value="auto-savings">Emergency Savings (Auto-deposit)</option>' : ''}
            ${goals.map(g => `<option value="${g.id}">Goal: ${g.name} (${formatCurrency(g.currentAmount, curr)})</option>`).join('')}
          </select>
        </div>
      </div>
    ` : ''}

    <!-- Minimal Submit Button (Warm Golden Gradient like earlier) -->
    <button id="payday-confirm-btn" class="squish-btn" style="width: 100%; padding: 0.65rem; font-weight: 800; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem; border-radius: var(--radius-md); background: linear-gradient(135deg, #FFB800 0%, #E69500 100%); color: #FFF; border: none; box-shadow: 0 4px 12px rgba(230, 149, 0, 0.28); cursor: pointer;">
      ${ICONS.check} Confirm Paycheck
    </button>
  `;

  // Attach Radio event for goal picker
  if (hasLeftover) {
    const radioInputs = card.querySelectorAll('input[name="leftover-action"]');
    const goalPicker = card.querySelector('#leftover-goal-picker');
    radioInputs.forEach(r => {
      r.addEventListener('change', () => {
        playPop();
        goalPicker.style.display = r.value === 'save' ? 'block' : 'none';
      });
    });
  }

  // Dismiss button
  card.querySelector('#payday-dismiss-btn').onclick = (e) => {
    e.stopPropagation();
    playPop();
    isDismissedForSession = true;
    card.style.opacity = '0';
    card.style.transform = 'translateY(-6px)';
    setTimeout(() => card.remove(), 150);
  };

  // Confirm button
  card.querySelector('#payday-confirm-btn').onclick = () => {
    const inputVal = card.querySelector('#payday-amount-input').value;
    const amount = parseFloat(inputVal) || pending.salary || 0;

    if (amount <= 0) {
      showToast({ text: "Please enter a valid paycheck amount.", icon: "⚠️" });
      return;
    }

    let leftoverAction = 'save';
    let goalId = null;

    if (hasLeftover) {
      const checkedRadio = card.querySelector('input[name="leftover-action"]:checked');
      leftoverAction = checkedRadio ? checkedRadio.value : 'save';
      if (leftoverAction === 'save') {
        const goalSelect = card.querySelector('#leftover-goal-select');
        goalId = goalSelect ? goalSelect.value : null;
      }
    }

    store.confirmPayday({
      amount,
      leftoverAction,
      goalId,
    });

    playSuccess();
    playCoin();
    firePastelConfetti();

    const toastMsg = (hasLeftover && leftoverAction === 'save')
      ? `Payday confirmed: ${formatCurrency(amount, curr)} logged (${formatCurrency(prev.leftover, curr)} to savings)`
      : `Payday confirmed: ${formatCurrency(amount, curr)} logged`;

    showToast({
      text: toastMsg,
      icon: 'check',
    });

    card.remove();
  };

  return card;
}

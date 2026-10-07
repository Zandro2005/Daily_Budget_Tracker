// ====================================================================
// CLOUDY BUDGET - DEDICATED BUDGET PLANNER VIEW (Mobile Optimized)
// Simple, intuitive, non-overwhelming budget planning for busy adults
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency } from '../lib/format.js';
import { playPop, playCoin, playSuccess } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderPlanner() {
  const container = document.createElement('div');
  container.className = 'planner-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const expectedIncome = settings.expectedIncome || 35000;
    const monthlyBudget = settings.monthlyBudget || 25000;
    const targetSavings = Math.max(0, expectedIncome - monthlyBudget);

    const summary = store.getMonthSummary();
    const allowance = store.getDailyAllowance();
    const catSpendings = store.getCategorySpending();

    // 1. Header with simple title
    const header = document.createElement('div');
    header.style.marginBottom = '1.25rem';
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
          ${ICONS.calendar} Budget Planner
        </h2>
        <button class="pill squish-btn" id="plan-503020-btn" style="cursor: pointer; border: none; padding: 0.4rem 0.75rem; font-size: 0.78rem; background: var(--sky-100); color: var(--primary);">
          50/30/20 Smart Rule
        </button>
      </div>
    `;

    header.querySelector('#plan-503020-btn').onclick = () => {
      playSuccess();
      store.apply503020Rule(expectedIncome);
      firePastelConfetti();
      showToast({ text: '50/30/20 Smart Rule applied!', icon: 'check' });
      renderContent();
    };

    container.appendChild(header);

    // 2. Safe Daily Spend Card
    const dailyCard = document.createElement('div');
    dailyCard.className = 'cloud-card';
    dailyCard.style.padding = '1.25rem';
    dailyCard.style.marginBottom = '1.25rem';
    dailyCard.style.background = 'linear-gradient(135deg, rgba(230, 245, 255, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%)';
    dailyCard.style.border = '2px solid var(--sky-200)';

    dailyCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
            Daily Safe Allowance
          </div>
          <div style="font-family: var(--font-display); font-size: 1.85rem; font-weight: 700; color: var(--primary); margin: 0.15rem 0;">
            ${formatCurrency(allowance.dailySafeSpend, curr)} <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">/ day</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
            ${allowance.daysRemaining} days left in this month &bull; ${formatCurrency(summary.remainingBudget, curr)} remaining
          </div>
        </div>
        <div style="background: #FFF; width: 50px; height: 50px; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); border: 2px solid var(--sky-200); color: var(--primary);">
          ${ICONS.wallet}
        </div>
      </div>
    `;
    container.appendChild(dailyCard);

    // 3. Monthly High-Level Target Allocator (Income vs Spend vs Save)
    const targetCard = document.createElement('div');
    targetCard.className = 'cloud-card';
    targetCard.style.padding = '1.25rem';
    targetCard.style.marginBottom = '1.25rem';

    targetCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span style="font-weight: 700; font-size: 0.95rem;">Monthly Blueprint</span>
        <button class="pill squish-btn" id="edit-targets-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">
          ✏️ Edit Goals
        </button>
      </div>

      <!-- 3 Key Metric Blocks -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center;">
        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Expected Income</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--mint-deep); margin-top: 0.2rem;">
            ${formatCurrency(expectedIncome, curr)}
          </div>
        </div>

        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Planned Spend</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--primary); margin-top: 0.2rem;">
            ${formatCurrency(monthlyBudget, curr)}
          </div>
        </div>

        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Target Savings</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--coral-alert); margin-top: 0.2rem;">
            ${formatCurrency(targetSavings, curr)}
          </div>
        </div>
      </div>
    `;

    targetCard.querySelector('#edit-targets-btn').onclick = () => {
      playPop();
      openBlueprintModal(expectedIncome, monthlyBudget);
    };

    container.appendChild(targetCard);

    // 4. Category Budget Envelopes (Planned vs Actual)
    const envelopesCard = document.createElement('div');
    envelopesCard.className = 'cloud-card';
    envelopesCard.style.padding = '1.25rem';
    envelopesCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          ${ICONS.folder} Envelopes
        </h3>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Tap to adjust</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;" id="envelopes-list"></div>
    `;

    const envelopesList = envelopesCard.querySelector('#envelopes-list');

    // Filter categories that have limits or spendings (excluding income)
    const filteredCats = catSpendings.filter(c => !c.name.toLowerCase().includes('income'));

    filteredCats.forEach(cat => {
      const isOver = cat.monthly_limit > 0 && cat.spent > cat.monthly_limit;
      const percent = cat.monthly_limit > 0 ? Math.min(100, Math.round((cat.spent / cat.monthly_limit) * 100)) : 0;
      const statusClass = isOver ? 'status-danger' : percent >= 80 ? 'status-warn' : 'status-safe';

      const itemEl = document.createElement('div');
      itemEl.style.cssText = 'background: var(--bg-card-cloud); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s ease;';

      itemEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary);">
              ${getCategoryIconSvg(cat.id || cat.name)}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${cat.name}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">
                Spent: <strong>${formatCurrency(cat.spent, curr)}</strong> of ${cat.monthly_limit > 0 ? formatCurrency(cat.monthly_limit, curr) : 'No cap'}
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="pill" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; background: ${isOver ? '#FFE8E8' : 'var(--sky-100)'}; color: ${isOver ? 'var(--danger)' : 'var(--text-main)'};">
              ${cat.monthly_limit > 0 ? (isOver ? `+${formatCurrency(cat.spent - cat.monthly_limit, curr)} over` : `${formatCurrency(cat.remaining, curr)} left`) : 'Set cap'}
            </span>
          </div>
        </div>

        <!-- Progress meter -->
        <div class="cloud-progress" style="height: 8px;">
          <div class="cloud-progress-fill ${statusClass}" style="width: ${percent}%;"></div>
        </div>
      `;

      itemEl.onclick = () => {
        playPop();
        openLimitModal(cat);
      };

      envelopesList.appendChild(itemEl);
    });

    container.appendChild(envelopesCard);
  }

  // Edit Targets Modal
  function openBlueprintModal(currentIncome, currentBudget) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">Edit Monthly Blueprint</h3>
          <button class="modal-close" id="bp-close">&times;</button>
        </div>
        <form id="bp-form">
          <div class="form-group">
            <label class="form-label">Expected Monthly Income (${store.getSettings().currency})</label>
            <input type="number" id="bp-income" class="form-input" required value="${currentIncome}" step="any">
          </div>
          <div class="form-group">
            <label class="form-label">Total Monthly Budget Cap (${store.getSettings().currency})</label>
            <input type="number" id="bp-budget" class="form-input" required value="${currentBudget}" step="any">
            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">
              The remaining amount will be your planned savings
            </small>
          </div>
          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.85rem; margin-top: 0.75rem;">
            Save Targets
          </button>
        </form>
      </div>
    `;

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 250);
    };

    backdrop.querySelector('#bp-close').onclick = close;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    backdrop.querySelector('#bp-form').onsubmit = (e) => {
      e.preventDefault();
      const inc = parseFloat(backdrop.querySelector('#bp-income').value) || 0;
      const bud = parseFloat(backdrop.querySelector('#bp-budget').value) || 0;

      store.updateSettings({
        expectedIncome: inc,
        monthlyBudget: bud,
      });

      playCoin();
      showToast({ text: 'Monthly plan updated', icon: 'check' });
      close();
      renderContent();
    };

    document.body.appendChild(backdrop);
  }

  // Adjust Category Limit Modal
  function openLimitModal(cat) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="color: var(--primary); display: flex;">${getCategoryIconSvg(cat.id || cat.name)}</span>
            <span>${cat.name}</span>
          </h3>
          <button class="modal-close" id="limit-close">&times;</button>
        </div>
        <form id="limit-form">
          <div class="form-group">
            <label class="form-label">Monthly Budget Limit (${store.getSettings().currency})</label>
            <input type="number" id="limit-val" class="form-input" style="font-size: 1.4rem; font-weight: 700;" required value="${cat.monthly_limit || 0}" step="any">
          </div>
          <div class="quick-amount-presets" style="margin-bottom: 1.25rem;">
            <button type="button" class="preset-chip" data-v="1500">+1,500</button>
            <button type="button" class="preset-chip" data-v="3000">+3,000</button>
            <button type="button" class="preset-chip" data-v="5000">+5,000</button>
          </div>
          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.85rem;">
            Save Envelope Cap
          </button>
        </form>
      </div>
    `;

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 250);
    };

    backdrop.querySelector('#limit-close').onclick = close;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    backdrop.querySelectorAll('.preset-chip').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const input = backdrop.querySelector('#limit-val');
        const curr = parseFloat(input.value) || 0;
        input.value = (curr + parseFloat(btn.dataset.v)).toString();
      };
    });

    backdrop.querySelector('#limit-form').onsubmit = (e) => {
      e.preventDefault();
      const val = parseFloat(backdrop.querySelector('#limit-val').value) || 0;
      store.updateCategoryLimit(cat.id, val);
      playCoin();
      showToast({ text: `Updated ${cat.name} limit! 🏷️`, icon: '✨' });
      close();
      renderContent();
    };

    document.body.appendChild(backdrop);
  }

  renderContent();
  return container;
}

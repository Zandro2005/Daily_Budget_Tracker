// ====================================================================
// CLOUDY BUDGET - DEDICATED CUTOFF BUDGET PLANNER VIEW
// Plan directly for a specific cutoff period (10th or 25th)
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, getPreviousCutoff, getNextCutoff, isDateInRange, formatDate } from '../lib/format.js';
import { playPop, playCoin, playSuccess } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

let selectedCutoff = null;

export function renderPlanner() {
  const container = document.createElement('div');
  container.className = 'planner-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency || '₱';
    const isSemi = (settings.payCycle || 'semi-monthly') === 'semi-monthly';

    const curCutoff = store.getCurrentCutoff();
    if (!selectedCutoff) {
      selectedCutoff = curCutoff;
    }

    const paydays = settings.paydays || [10, 25];
    const plan = isSemi ? store.getCutoffPlan(selectedCutoff) : store.getMonthPlan();
    const summary = isSemi ? store.getCutoffSummary(selectedCutoff) : store.getMonthSummary();
    const allowance = store.getDailyAllowance();
    const catSpendings = isSemi ? store.getCutoffCategorySpending(selectedCutoff) : store.getCategorySpending();

    // 1. Header with title and 50/30/20 Smart Rule for this cutoff
    const header = document.createElement('div');
    header.style.marginBottom = '1.15rem';
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h2 style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
            ${ICONS.calendar} ${isSemi ? 'Cutoff Planner' : 'Budget Planner'}
          </h2>
          <p style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; margin: 0.15rem 0 0 0;">
            Plan budget & limits strictly for ${isSemi ? selectedCutoff.label : 'this month'}
          </p>
        </div>
        <button class="pill squish-btn" id="plan-503020-btn" style="cursor: pointer; border: none; padding: 0.45rem 0.8rem; font-size: 0.78rem; background: var(--sky-100); color: var(--primary); font-weight: 700;">
          50/30/20 Rule
        </button>
      </div>
    `;

    header.querySelector('#plan-503020-btn').onclick = () => {
      playSuccess();
      if (isSemi) {
        store.applyCutoff503020Rule(selectedCutoff.id, plan.paycheck);
        showToast({ text: `50/30/20 Rule applied for ${selectedCutoff.label}!`, icon: 'check' });
      } else {
        store.apply503020Rule(plan.paycheck);
        showToast({ text: '50/30/20 Smart Rule applied!', icon: 'check' });
      }
      firePastelConfetti();
      renderContent();
    };

    container.appendChild(header);

    // 2. Cutoff Period Switcher (if semi-monthly)
    if (isSemi) {
      const switcherCard = document.createElement('div');
      switcherCard.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-cloud); padding: 0.65rem 0.85rem; border-radius: var(--radius-lg); border: 1.5px solid var(--border-color); margin-bottom: 1.15rem; box-shadow: var(--shadow-sm);';

      const isCurrent = selectedCutoff.id === curCutoff.id;

      switcherCard.innerHTML = `
        <button id="cutoff-prev-btn" class="icon-btn squish-btn" title="Previous Cutoff" style="width: 34px; height: 34px; border-radius: var(--radius-full); background: var(--sky-100); border: none; color: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${ICONS.chevronLeft}
        </button>

        <div style="text-align: center;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
            ${isCurrent ? 'Current Pay Period' : 'Planning Period'}
          </div>
          <div style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; color: var(--primary); margin-top: 0.1rem;">
            ${selectedCutoff.label}
          </div>
        </div>

        <button id="cutoff-next-btn" class="icon-btn squish-btn" title="Next Cutoff" style="width: 34px; height: 34px; border-radius: var(--radius-full); background: var(--sky-100); border: none; color: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${ICONS.chevronRight}
        </button>
      `;

      switcherCard.querySelector('#cutoff-prev-btn').onclick = () => {
        playPop();
        selectedCutoff = getPreviousCutoff(selectedCutoff, paydays);
        renderContent();
      };

      switcherCard.querySelector('#cutoff-next-btn').onclick = () => {
        playPop();
        selectedCutoff = getNextCutoff(selectedCutoff, paydays);
        renderContent();
      };

      container.appendChild(switcherCard);
    }

    // 3. Safe Daily Allowance Card for this Cutoff
    const dailyCard = document.createElement('div');
    dailyCard.className = 'cloud-card';
    dailyCard.style.padding = '1.25rem';
    dailyCard.style.marginBottom = '1.25rem';
    dailyCard.style.background = 'linear-gradient(135deg, rgba(230, 245, 255, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%)';
    dailyCard.style.border = '2px solid var(--sky-200)';

    dailyCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.76rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
            Cutoff Daily Safe Spend
          </div>
          <div style="font-family: var(--font-display); font-size: 1.85rem; font-weight: 800; color: var(--primary); margin: 0.15rem 0;">
            ${formatCurrency(allowance.dailySafeSpend, curr)} <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">/ day</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
            ${allowance.daysRemaining} days left in ${isSemi ? selectedCutoff.label : 'this month'} &bull; ${formatCurrency(summary.remainingBudget, curr)} remaining
          </div>
        </div>
        <div style="background: #FFF; width: 48px; height: 48px; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); border: 2px solid var(--sky-200); color: var(--primary); flex-shrink: 0;">
          ${ICONS.wallet}
        </div>
      </div>
    `;
    container.appendChild(dailyCard);

    // 4. Cutoff Blueprint Card
    const targetCard = document.createElement('div');
    targetCard.className = 'cloud-card';
    targetCard.style.padding = '1.25rem';
    targetCard.style.marginBottom = '1.25rem';

    const periodSalary = plan.paycheck;
    const periodPlannedSpend = plan.spendBudget;
    const periodSavings = plan.savingsTarget;
    const savingsPercentDisplay = Math.round((plan.savingsRate || 0) * 100);

    targetCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <span style="font-weight: 700; font-size: 0.95rem;">${isSemi ? `${selectedCutoff.label} Blueprint` : 'Monthly Blueprint'}</span>
          ${plan.isExpected ? `
            <span class="pill" style="font-size: 0.68rem; padding: 0.15rem 0.5rem; background: var(--sky-100); color: var(--primary); font-weight: 700;">
              Expected
            </span>
          ` : `
            <span class="pill" style="font-size: 0.68rem; padding: 0.15rem 0.5rem; background: var(--mint-soft); color: var(--mint-deep); font-weight: 700;">
              Logged Income
            </span>
          `}
        </div>
        <button class="pill squish-btn" id="edit-targets-btn" style="cursor: pointer; border: none; font-size: 0.75rem; padding: 0.35rem 0.65rem;">
          ✏️ Edit Blueprint
        </button>
      </div>

      <!-- 3 Key Metric Blocks -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center;">
        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">${isSemi ? 'Paycheck' : 'Income'}</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--mint-deep); margin-top: 0.2rem;">
            ${formatCurrency(periodSalary, curr)}
          </div>
        </div>

        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Spend Budget</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--primary); margin-top: 0.2rem;">
            ${formatCurrency(periodPlannedSpend, curr)}
          </div>
        </div>

        <div style="background: var(--bg-card-cloud); padding: 0.65rem 0.4rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Target Savings (${savingsPercentDisplay}%)</div>
          <div style="font-family: var(--font-display); font-size: 0.98rem; font-weight: 700; color: var(--coral-alert); margin-top: 0.2rem;">
            ${formatCurrency(periodSavings, curr)}
          </div>
        </div>
      </div>

      <!-- Carried In Note if present -->
      ${summary.carriedIn > 0 ? `
        <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--mint-deep); font-weight: 700; text-align: center; background: rgba(156, 227, 192, 0.2); padding: 0.35rem 0.6rem; border-radius: var(--radius-sm);">
          ✨ +${formatCurrency(summary.carriedIn, curr)} carried over from previous cutoff!
        </div>
      ` : ''}
    `;

    targetCard.querySelector('#edit-targets-btn').onclick = () => {
      playPop();
      openBlueprintModal(selectedCutoff, plan);
    };

    container.appendChild(targetCard);

    // 5. Bills Due in this Cutoff Period
    if (isSemi) {
      const allRecurring = store.getRecurring();
      const cutoffBills = allRecurring.filter(r => isDateInRange(r.nextDue, selectedCutoff.start, selectedCutoff.end));

      if (cutoffBills.length > 0) {
        const billsCard = document.createElement('div');
        billsCard.className = 'cloud-card';
        billsCard.style.cssText = 'padding: 1.15rem; margin-bottom: 1.25rem;';
        billsCard.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div style="font-weight: 700; font-size: 0.92rem; display: flex; align-items: center; gap: 0.35rem;">
              <span style="color: var(--primary); display: inline-flex;">${ICONS.repeat}</span>
              <span>Bills due in this cutoff (${cutoffBills.length})</span>
            </div>
            <span style="font-weight: 800; font-size: 0.88rem; color: var(--coral-alert);">
              ${formatCurrency(cutoffBills.reduce((acc, b) => acc + b.amount, 0), curr)}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${cutoffBills.map(b => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card-cloud); padding: 0.55rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.82rem;">
                <div>
                  <span style="font-weight: 700;">${b.name}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: 0.35rem;">Due ${formatDate(b.nextDue)}</span>
                </div>
                <span style="font-weight: 800; font-family: var(--font-display);">${formatCurrency(b.amount, curr)}</span>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(billsCard);
      }
    }

    // 6. Cutoff Category Envelopes (Planned vs Actual for this cutoff)
    const envelopesCard = document.createElement('div');
    envelopesCard.className = 'cloud-card';
    envelopesCard.style.padding = '1.25rem';
    envelopesCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
            ${ICONS.folder} ${isSemi ? `${selectedCutoff.label} Envelopes` : 'Category Envelopes'}
          </h3>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Tap any envelope to set its limit for this cutoff</span>
        </div>
        <button class="icon-btn squish-btn" id="add-env-btn" style="width: 32px; height: 32px; background: var(--primary); color: white; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;" title="Add Envelope">
          ${ICONS.plusCircle}
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;" id="envelopes-list"></div>
    `;

    const envelopesList = envelopesCard.querySelector('#envelopes-list');
    
    const addEnvBtn = envelopesCard.querySelector('#add-env-btn');
    if (addEnvBtn) {
      addEnvBtn.onclick = () => {
        playPop();
        openLimitModal(null, selectedCutoff);
      };
    }

    const filteredCats = catSpendings.filter(c => !c.name.toLowerCase().includes('income'));

    filteredCats.forEach(cat => {
      const limit = isSemi ? (cat.period_limit || 0) : (cat.monthly_limit || 0);
      const isOver = limit > 0 && cat.spent > limit;
      const percent = limit > 0 ? Math.min(100, Math.round((cat.spent / limit) * 100)) : 0;
      const statusClass = isOver ? 'status-danger' : percent >= 80 ? 'status-warn' : 'status-safe';

      const itemEl = document.createElement('div');
      itemEl.style.cssText = 'background: var(--bg-card-cloud); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s ease;';

      itemEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 0.6rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                ${getCategoryIconSvg(cat.id || cat.name)}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem;">
              <div style="color: var(--text-muted); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                ${ICONS.settings}
              </div>
              <span class="pill" style="font-size: 0.68rem; padding: 0.2rem 0.45rem; background: ${isOver ? '#FFE8E8' : 'var(--sky-100)'}; color: ${isOver ? 'var(--danger)' : 'var(--text-main)'}; font-weight: 700;">
                ${limit > 0 ? (isOver ? `+${formatCurrency(cat.spent - limit, curr)}` : `${formatCurrency(Math.max(0, limit - cat.spent), curr)}`) : 'No Limit'}
              </span>
            </div>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); line-height: 1.1; margin-bottom: 0.2rem;">${cat.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">
              Spent: <strong style="color: var(--text-main);">${formatCurrency(cat.spent, curr)}</strong>
            </div>
          </div>
        </div>

        <div class="cloud-progress" style="height: 8px;">
          <div class="cloud-progress-fill ${statusClass}" style="width: ${percent}%;"></div>
        </div>
      `;

      itemEl.onclick = () => {
        playPop();
        openLimitModal(cat, selectedCutoff);
      };

      envelopesList.appendChild(itemEl);
    });

    container.appendChild(envelopesCard);
  }

  // Edit Targets strictly for this Specific Cutoff
  function openBlueprintModal(cutoff, plan) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';

    const curr = store.getSettings().currency || '₱';
    const currentSavingsPct = Math.round((plan.savingsRate || 0.2857) * 100);

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">Plan ${cutoff.label}</h3>
          <button class="modal-close" id="bp-close">&times;</button>
        </div>
        <form id="bp-form">
          <div class="form-group">
            <label class="form-label">Cutoff Paycheck / Expected Salary (${curr})</label>
            <input type="number" id="bp-salary" class="form-input" required value="${plan.paycheck || ''}" placeholder="0" step="any" style="font-size: 1.25rem; font-weight: 700;">
            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">
              Paycheck for this ${cutoff.payday ? `${cutoff.payday}th` : ''} cutoff period
            </small>
          </div>

          <div class="form-group">
            <label class="form-label">Savings Target (% of this paycheck)</label>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="number" id="bp-savings-pct" class="form-input" required min="0" max="90" step="1" value="${currentSavingsPct}" style="font-size: 1.15rem; font-weight: 700;">
              <span style="font-weight: 800; font-size: 1.15rem; color: var(--coral-alert);">%</span>
            </div>
            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">
              Portion set aside into savings (e.g. 20% or 29%)
            </small>
          </div>

          <!-- Dynamic Live Calculator Box for this Cutoff -->
          <div style="background: rgba(240, 248, 255, 0.85); padding: 0.85rem; border-radius: var(--radius-md); border: 1px dashed var(--sky-300); margin-bottom: 1.15rem;">
            <div style="font-size: 0.72rem; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 0.35rem;">
              Cutoff Allocation Preview
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
              <span>Spend Budget: <strong id="bp-preview-spend" style="color: var(--primary);">₱0</strong></span>
              <span>Savings: <strong id="bp-preview-save" style="color: var(--coral-alert);">₱0</strong></span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary squish-btn" style="width: 100%; padding: 0.85rem;">
            Save Cutoff Plan
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

    const salaryInput = backdrop.querySelector('#bp-salary');
    const savingsInput = backdrop.querySelector('#bp-savings-pct');
    const previewSpend = backdrop.querySelector('#bp-preview-spend');
    const previewSave = backdrop.querySelector('#bp-preview-save');

    function updatePreview() {
      const salary = parseFloat(salaryInput.value) || 0;
      const pct = parseFloat(savingsInput.value) || 0;
      const rate = Math.max(0, Math.min(0.9, pct / 100));
      const saveAmt = Math.round(salary * rate);
      const spendAmt = Math.max(0, salary - saveAmt);
      previewSpend.textContent = formatCurrency(spendAmt, curr);
      previewSave.textContent = formatCurrency(saveAmt, curr);
    }

    salaryInput.oninput = updatePreview;
    savingsInput.oninput = updatePreview;
    updatePreview();

    backdrop.querySelector('#bp-form').onsubmit = (e) => {
      e.preventDefault();
      const newPaycheck = parseFloat(salaryInput.value) || 0;
      const savingsPct = parseFloat(savingsInput.value) || 20;
      const newSavingsRate = Math.max(0, Math.min(0.9, savingsPct / 100));

      const newSavingsTarget = Math.round(newPaycheck * newSavingsRate);
      const newSpendBudget = Math.max(0, newPaycheck - newSavingsTarget);

      // Save into cutoff record for this specific cutoff
      const record = store.getCutoffRecord(cutoff.id) || { id: cutoff.id };
      record.expectedSalary = newPaycheck;
      record.savingsRate = newSavingsRate;
      record.customSpendBudget = newSpendBudget;
      store.saveCutoffRecord(record);

      // Also update settings.salaryByPayday for this payday if applicable
      const currentSalaries = { ...(store.getSettings().salaryByPayday || { 10: 0, 25: 0 }) };
      if (cutoff.payday) {
        currentSalaries[cutoff.payday] = newPaycheck;
        store.updateSettings({
          salaryByPayday: currentSalaries,
          expectedIncome: (currentSalaries[10] || 0) + (currentSalaries[25] || 0),
          savingsRate: newSavingsRate,
        });
      }

      playCoin();
      showToast({ text: `Plan saved for ${cutoff.label}! ☁️`, icon: 'check' });
      close();
      renderContent();
    };

    document.body.appendChild(backdrop);
  }

  // Adjust Category Limit strictly for this Specific Cutoff
  function openLimitModal(cat, cutoff) {
    const isEdit = Boolean(cat);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';

    const curr = store.getSettings().currency || '₱';
    const currentLimit = isEdit ? (cat.period_limit || Math.round((cat.monthly_limit || 0) / 2) || 0) : 0;
    const catName = isEdit ? cat.name : '';

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 0.45rem;">
            ${isEdit ? `<span style="color: var(--primary); display: flex;">${getCategoryIconSvg(cat.id || cat.name)}</span>` : ''}
            <span>${isEdit ? `${cat.name} (${cutoff.label})` : 'New Envelope'}</span>
          </h3>
          <button class="modal-close" id="limit-close">&times;</button>
        </div>
        <form id="limit-form">
          <div class="form-group">
            <label class="form-label">Envelope Name</label>
            <input type="text" id="env-name" class="form-input" required value="${catName}" placeholder="e.g. Groceries, Dine Out...">
          </div>

          <div class="form-group">
            <label class="form-label">Cutoff Limit (${curr})</label>
            <input type="number" id="limit-val" class="form-input" style="font-size: 1.4rem; font-weight: 700;" required value="${currentLimit}" step="any">
            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">
              Spending limit strictly for the ${cutoff.label} period
            </small>
          </div>
          <div class="quick-amount-presets" style="margin-bottom: 1.25rem;">
            <button type="button" class="preset-chip" data-v="500">+500</button>
            <button type="button" class="preset-chip" data-v="1000">+1,000</button>
            <button type="button" class="preset-chip" data-v="2000">+2,000</button>
          </div>
          
          <div style="display: flex; gap: 0.5rem;">
            ${isEdit && (!cat.id || !cat.id.startsWith('cat-income')) ? `
              <button type="button" class="btn btn-danger squish-btn" id="env-delete-btn" style="flex: 1; padding: 0.85rem;">
                Delete
              </button>
            ` : ''}
            <button type="submit" class="btn btn-primary squish-btn" style="flex: ${isEdit ? '2' : '1'}; padding: 0.85rem;">
              Save Envelope
            </button>
          </div>
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

    const input = backdrop.querySelector('#limit-val');

    backdrop.querySelectorAll('.preset-chip').forEach(btn => {
      btn.onclick = () => {
        playPop();
        const currentVal = parseFloat(input.value) || 0;
        input.value = (currentVal + parseFloat(btn.dataset.v)).toString();
      };
    });

    const deleteBtn = backdrop.querySelector('#env-delete-btn');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (confirm(`Delete envelope "${cat.name}"?`)) {
          store.deleteCategory(cat.id);
          showToast({ text: 'Envelope deleted' });
          close();
          renderContent();
        }
      };
    }

    backdrop.querySelector('#limit-form').onsubmit = (e) => {
      e.preventDefault();
      const val = parseFloat(input.value) || 0;
      const nameVal = backdrop.querySelector('#env-name').value;
      
      let targetCatId;
      if (isEdit) {
        targetCatId = cat.id;
        store.updateCategory(cat.id, { name: nameVal });
      } else {
        const newCat = store.addCategory({ name: nameVal, monthly_limit: val * 2 });
        targetCatId = newCat.id;
      }
      
      store.updateCutoffCategoryLimit(cutoff.id, targetCatId, val);
      playCoin();
      showToast({ text: `Saved ${nameVal}! 🏷️`, icon: '✨' });
      close();
      renderContent();
    };

    document.body.appendChild(backdrop);
  }

  renderContent();
  return container;
}

// ====================================================================
// CLOUDY BUDGET - DEDICATED CUTOFF BUDGET PLANNER VIEW
// Plan directly for a specific cutoff period (10th or 25th)
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, getPreviousCutoff, getNextCutoff, isDateInRange, formatDate, escapeHtml } from '../lib/format.js';
import { playPop, playCoin, playSuccess } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

let selectedCutoff = null;

export function renderPlanner() {
  const container = document.createElement('div');
  container.className = 'planner-view anim-fade-in';
  container.style.paddingBottom = '6.5rem';

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
                  <span style="font-weight: 700;">${escapeHtml(b.name)}</span>
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

    // Helper function for Windows Folder SVG
    function getWindowsFolderSvg(uniqueId) {
      const safeId = String(uniqueId).replace(/[^a-zA-Z0-9_-]/g, '_');
      return `
        <svg viewBox="0 0 100 86" width="84" height="72" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(220, 160, 20, 0.28));">
          <defs>
            <linearGradient id="wfBackGrad_${safeId}" x1="20" y1="10" x2="80" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFD65C"/>
              <stop offset="100%" stop-color="#EAA615"/>
            </linearGradient>
            <linearGradient id="wfFrontGrad_${safeId}" x1="15" y1="26" x2="85" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFE785"/>
              <stop offset="40%" stop-color="#FED049"/>
              <stop offset="100%" stop-color="#F3AE1A"/>
            </linearGradient>
            <linearGradient id="wfSpineGrad_${safeId}" x1="10" y1="26" x2="20" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#F7BE2F"/>
              <stop offset="100%" stop-color="#D9940A"/>
            </linearGradient>
          </defs>
          
          <!-- Back Tab & Back Plate (Perspective) -->
          <path d="M 18 12 C 18 10 19.5 8.5 21.5 8.5 L 43 8.5 C 45 8.5 46.5 9.5 47.5 11 L 52 17 L 85 17 C 87.5 17 89 18.5 89 21 L 89 65 C 89 67 87.5 68.5 85 68.5 L 21.5 68.5 C 19.5 68.5 18 67 18 65 Z" fill="url(#wfBackGrad_${safeId})"/>
          
          <!-- Paper sheet peeking inside -->
          <rect x="25" y="16" width="56" height="36" rx="2" fill="#FFFFFF" fill-opacity="0.95"/>
          <rect x="30" y="22" width="34" height="2.5" rx="1.25" fill="#CBD5E1"/>
          <rect x="30" y="27" width="44" height="2.5" rx="1.25" fill="#E2E8F0"/>
          <rect x="30" y="32" width="24" height="2.5" rx="1.25" fill="#E2E8F0"/>

          <!-- Left spine / opening angle (Perspective 3D effect) -->
          <path d="M 14 30 L 22 24 L 22 72 L 14 78 Z" fill="url(#wfSpineGrad_${safeId})"/>

          <!-- Front Open Flap (angled out towards user) -->
          <path d="M 22 24 C 22 22.5 23.5 21.5 25 21.5 L 89 21.5 C 91 21.5 92.5 22.8 92.8 24.8 L 97 68 C 97.2 70.2 95.5 72 93.3 72 L 23 72 C 21.5 72 20.5 71 20.5 69.5 L 22 24 Z" fill="url(#wfFrontGrad_${safeId})"/>
          
          <!-- Front Flap Top Lip Highlight -->
          <path d="M 23 23 L 89 23" stroke="#FFF7C2" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
    }

    // 6. Cutoff Category Envelopes (Windows File Explorer Folder Style)
    const envelopesCard = document.createElement('div');
    envelopesCard.className = 'cloud-card';
    envelopesCard.style.padding = '1.25rem';

    const cutoffSpendBudget = plan.spendBudget || 0;
    const filteredCats = catSpendings.filter(c => !c.name.toLowerCase().includes('income'));
    const totalAllocated = filteredCats.reduce((acc, c) => acc + (c.period_limit || 0), 0);
    const isOverallocated = cutoffSpendBudget > 0 && totalAllocated > cutoffSpendBudget;
    const overlapDiff = totalAllocated - cutoffSpendBudget;
    const unallocated = cutoffSpendBudget - totalAllocated;
    const allocPercent = cutoffSpendBudget > 0 ? Math.min(100, Math.round((totalAllocated / cutoffSpendBudget) * 100)) : 0;

    envelopesCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem; margin: 0; color: var(--text-main);">
            ${isSemi ? `${selectedCutoff.label} Envelopes` : 'Category Envelopes'}
          </h3>
          <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">
            Cutoff Spend Budget: <strong style="color: var(--text-main);">${formatCurrency(cutoffSpendBudget, curr)}</strong>
          </span>
        </div>
        <button class="btn btn-primary squish-btn" id="add-env-btn" style="padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-full);">
          Add
        </button>
      </div>

      <!-- Budget Allocation Bar -->
      <div style="background: var(--bg-card-cloud); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.65rem 0.85rem; margin-bottom: ${isOverallocated ? '0.75rem' : '1.15rem'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <div style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Allocated</div>
            <div style="font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: ${isOverallocated ? 'var(--coral-alert)' : 'var(--primary)'}; margin-top: 0.1rem;">
              ${formatCurrency(totalAllocated, curr)} <span style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted);">of ${formatCurrency(cutoffSpendBudget, curr)}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">${isOverallocated ? 'Over by' : 'Remaining'}</div>
            <div style="font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: ${isOverallocated ? 'var(--coral-alert)' : 'var(--text-main)'}; margin-top: 0.1rem;">
              ${isOverallocated ? formatCurrency(overlapDiff, curr) : formatCurrency(Math.max(0, unallocated), curr)}
            </div>
          </div>
        </div>
        <div class="cloud-progress" style="height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
          <div class="cloud-progress-fill ${isOverallocated ? 'status-danger' : 'status-safe'}" style="width: ${allocPercent}%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Overlap or No-Budget Warning Banner -->
      ${isOverallocated ? `
        <div style="background: rgba(255, 123, 137, 0.12); border: 1.5px solid var(--coral-alert); border-radius: var(--radius-md); padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; color: var(--coral-alert); font-size: 0.78rem; font-weight: 700; line-height: 1.35;">
          ⚠️ Budget Warning: Envelope allocations (${formatCurrency(totalAllocated, curr)}) overlap and exceed your cutoff spend budget (${formatCurrency(cutoffSpendBudget, curr)}) by ${formatCurrency(overlapDiff, curr)}. Adjust limits to stay within budget.
        </div>
      ` : (cutoffSpendBudget <= 0 ? `
        <div style="background: rgba(255, 235, 237, 0.95); border: 1.5px solid var(--coral-alert); border-radius: var(--radius-md); padding: 0.75rem 0.95rem; margin-bottom: 1.15rem; color: #B91C1C; font-size: 0.8rem; font-weight: 700; line-height: 1.35; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="display: inline-flex; width: 16px; height: 16px; flex-shrink: 0;">${ICONS.alertTriangle}</span>
            <span>No budget set for ${selectedCutoff.label}. Envelopes cannot be allocated until you set a budget in the Blueprint.</span>
          </div>
          <button type="button" class="btn btn-primary squish-btn" id="open-blueprint-cta-btn" style="padding: 0.35rem 0.85rem; font-size: 0.75rem; border-radius: var(--radius-full);">
            Set Blueprint Budget
          </button>
        </div>
      ` : '')}

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 0.85rem; width: 100%;" id="envelopes-list"></div>
    `;

    const envelopesList = envelopesCard.querySelector('#envelopes-list');

    const bpCtaBtn = envelopesCard.querySelector('#open-blueprint-cta-btn');
    if (bpCtaBtn) {
      bpCtaBtn.onclick = () => {
        playPop();
        openBlueprintModal(selectedCutoff, plan);
      };
    }

    const addEnvBtn = envelopesCard.querySelector('#add-env-btn');
    if (addEnvBtn) {
      addEnvBtn.onclick = () => {
        playPop();
        if (cutoffSpendBudget <= 0) {
          showToast({ text: `Cannot allocate envelopes: No budget set for ${selectedCutoff.label}. Please set your budget in Blueprint first.` });
          openBlueprintModal(selectedCutoff, plan);
          return;
        }
        openLimitModal(null, selectedCutoff);
      };
    }

    filteredCats.forEach(cat => {
      const isMisc = cat.id === 'cat-misc' || cat.name.toLowerCase().includes('misc');
      const limit = isSemi ? (cat.period_limit || 0) : (cat.monthly_limit || 0);
      const isOver = cat.isExceeded;
      const percent = cat.percent;
      const statusClass = isOver ? 'status-danger' : percent >= 80 ? 'status-warn' : 'status-safe';
      const remaining = cat.remaining;
      const hasFunds = (cat.totalFunds > 0) || (limit > 0);

      const itemEl = document.createElement('div');
      itemEl.className = 'folder-item squish-btn';
      itemEl.title = isMisc ? `${cat.name} (No set budget required - flexible envelope)` : `Click to set budget for ${cat.name}`;

      itemEl.innerHTML = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-bottom: 0.4rem;">
          ${getWindowsFolderSvg(cat.id || cat.name)}
          ${isOver ? `
            <div style="position: absolute; top: -4px; right: calc(50% - 38px); background: var(--coral-alert); color: white; border-radius: var(--radius-full); padding: 0.1rem 0.45rem; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.68rem; box-shadow: 0 2px 8px rgba(255,100,100,0.4); border: 2px solid white;">
              Over!
            </div>
          ` : (cat.unpaidLoans > 0 ? `
            <div style="position: absolute; top: -4px; right: calc(50% - 42px); background: #F59E0B; color: white; border-radius: var(--radius-full); padding: 0.1rem 0.4rem; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.65rem; box-shadow: 0 2px 8px rgba(245,158,11,0.4); border: 2px solid white;">
              🤝 Lent
            </div>
          ` : (cat.deposited > 0 && cat.allocatedLimit === 0 ? `
            <div style="position: absolute; top: -4px; right: calc(50% - 42px); background: var(--mint-deep); color: white; border-radius: var(--radius-full); padding: 0.1rem 0.4rem; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.65rem; box-shadow: 0 2px 8px rgba(86,193,144,0.4); border: 2px solid white;">
              +Added
            </div>
          ` : ''))}
        </div>
        
        <div style="font-weight: 800; font-family: var(--font-display); font-size: 0.94rem; color: var(--text-main); line-height: 1.2; text-align: center; margin-bottom: 0.2rem; width: 100%;">
          ${escapeHtml(cat.name)}
        </div>
        ${isMisc ? `
          <div style="width: 100%; display: flex; justify-content: center; margin-bottom: 0.4rem;">
            <span class="pill" style="font-size: 0.62rem; font-weight: 700; padding: 0.15rem 0.45rem; background: var(--sky-100); color: var(--primary); border: 1px solid var(--sky-300); border-radius: var(--radius-full); max-width: 100%; white-space: normal; text-align: center; line-height: 1.25;">
              No need to set budget
            </span>
          </div>
        ` : ''}

        ${hasFunds ? `
          <!-- Funds Available (either allocated budget or deposited money like excess from last cutoff) -->
          <div style="font-family: var(--font-display); font-size: 1.18rem; font-weight: 800; color: ${isOver ? 'var(--coral-alert)' : 'var(--mint-deep)'}; text-align: center; line-height: 1.1; margin-bottom: 0.2rem;">
            ${isOver ? `-${formatCurrency(cat.spent - cat.totalFunds, curr)}` : formatCurrency(remaining, curr)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 0.6rem;">
            ${isOver ? 'Over envelope funds' : (cat.unpaidLoans > 0 ? `left of ${formatCurrency(cat.totalFunds, curr)} (${formatCurrency(cat.unpaidLoans, curr)} lent)` : (cat.deposited > 0 && cat.allocatedLimit === 0 ? `left of ${formatCurrency(cat.deposited, curr)} added` : (isMisc ? `available funds &bull; flex envelope` : `left of ${formatCurrency(cat.totalFunds, curr)}`)))}
          </div>

          <div style="width: 100%; margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 0.28rem;">
            <div class="cloud-progress" style="height: 6px; width: 100%; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
              <div class="cloud-progress-fill ${statusClass}" style="width: ${percent}%;"></div>
            </div>
            <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">
              ${formatCurrency(cat.spent, curr)} spent
            </div>
          </div>
        ` : (isMisc && cat.spent > 0 ? `
          <!-- Miscellaneous Envelope: Spent from cutoff budget -->
          <div style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: var(--text-main); text-align: center; line-height: 1.1; margin-bottom: 0.2rem;">
            ${formatCurrency(cat.spent, curr)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 0.6rem;">
            spent from cutoff
          </div>
          <div style="margin-top: auto;">
            <span class="pill" style="font-size: 0.72rem; padding: 0.3rem 0.65rem; background: var(--sky-100); color: var(--primary); font-weight: 700; border: 1px dashed var(--sky-300);">
              Flex Envelope
            </span>
          </div>
        ` : (cat.spent > 0 ? `
          <!-- No Budget Set but Spent -->
          <div style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: var(--coral-alert); text-align: center; line-height: 1.1; margin-bottom: 0.2rem;">
            -${formatCurrency(cat.spent, curr)}
          </div>
          <div style="font-size: 0.72rem; color: var(--coral-alert); font-weight: 600; text-align: center; margin-bottom: 0.6rem;">
            spent without budget
          </div>
          <div style="margin-top: auto;">
            <span class="pill" style="font-size: 0.72rem; padding: 0.32rem 0.75rem; background: rgba(255,123,137,0.12); color: var(--coral-alert); font-weight: 700; border: 1px dashed var(--coral-alert);">
              + Set Budget
            </span>
          </div>
        ` : (isMisc ? `
          <!-- Miscellaneous Envelope: No set budget needed -->
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-align: center; margin: 0.25rem 0 0.55rem 0; line-height: 1.25;">
            Flexible envelope &bull; Uses cutoff spend
          </div>
          <div style="margin-top: auto;">
            <span class="pill" style="font-size: 0.72rem; padding: 0.3rem 0.65rem; background: var(--sky-100); color: var(--primary); font-weight: 700; border: 1px dashed var(--sky-300); display: inline-flex; align-items: center; gap: 0.25rem;">
              Flex Envelope
            </span>
          </div>
        ` : `
          <!-- Unallocated State: Clean & Friendly Call to Action -->
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-align: center; margin: 0.35rem 0 0.85rem 0;">
            No budget set
          </div>
          <div style="margin-top: auto;">
            <span class="pill" style="font-size: 0.72rem; padding: 0.32rem 0.75rem; background: var(--sky-100); color: var(--primary); font-weight: 700; border: 1px dashed var(--sky-300); display: inline-flex; align-items: center; gap: 0.25rem;">
              ${cutoffSpendBudget <= 0 ? 'Set Budget First' : '+ Set Budget'}
            </span>
          </div>
        `)))}
      `;

      itemEl.onclick = () => {
        playPop();
        if (cutoffSpendBudget <= 0) {
          showToast({ text: `Cannot allocate envelopes: No budget set for ${selectedCutoff.label}. Set budget in Blueprint first.` });
          openBlueprintModal(selectedCutoff, plan);
          return;
        }
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
    const isSemi = (store.getSettings().payCycle || 'semi-monthly') === 'semi-monthly';
    const activeCutoff = cutoff || store.getCurrentCutoff();
    const plan = isSemi ? store.getCutoffPlan(activeCutoff) : store.getMonthPlan();
    const cutoffLabel = activeCutoff ? activeCutoff.label : 'cutoff';
    const hasSpendBudget = (plan.spendBudget || 0) > 0;

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 0.45rem;">
            ${isEdit ? `<span style="color: var(--primary); display: flex;">${getCategoryIconSvg(cat.id || cat.name)}</span>` : ''}
            <span>${isEdit ? `Allocate: ${escapeHtml(cat.name)}` : 'New Envelope'}</span>
          </h3>
          <button class="modal-close" id="limit-close">&times;</button>
        </div>
        <form id="limit-form">
          <div class="form-group">
            <label class="form-label">Envelope Name</label>
            <input type="text" id="env-name" class="form-input" required value="${escapeHtml(catName)}" placeholder="e.g. Bills, Shopping, Daily...">
          </div>

          ${!hasSpendBudget ? `
            <div style="margin-bottom: 0.85rem; padding: 0.65rem 0.8rem; background: rgba(255, 235, 237, 0.95); border: 1.5px solid var(--coral-alert); border-radius: var(--radius-sm); color: #B91C1C; font-size: 0.78rem; line-height: 1.35;">
              <strong>⚠️ No Cutoff Budget Set:</strong> You cannot allocate funds to envelopes because no spend budget has been set for ${cutoffLabel} (${curr} 0). Please set your expected paycheck or income in the Blueprint first.
            </div>
          ` : (isEdit && (cat.id === 'cat-misc' || cat.name.toLowerCase().includes('misc')) ? `
            <div style="margin-bottom: 0.85rem; padding: 0.55rem 0.75rem; background: var(--sky-100); border: 1px solid var(--sky-300); border-radius: var(--radius-sm); font-size: 0.76rem; color: var(--primary); line-height: 1.4;">
              <strong>Flexible Envelope:</strong> Setting a budget for Miscellaneous is <strong>optional</strong>. It works automatically without a set budget and uses flexible cutoff spending.
            </div>
          ` : '')}

          <div class="form-group">
            <label class="form-label">Allocated Budget (${curr})</label>
            <input type="number" id="limit-val" class="form-input" style="font-size: 1.4rem; font-weight: 700;" required value="${Math.round(currentLimit)}" step="1" placeholder="0">
            <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">
              ${!hasSpendBudget ? `No spend budget set for ${cutoffLabel}. Setting an allocation requires a budget first.` : (isEdit && (cat.id === 'cat-misc' || cat.name.toLowerCase().includes('misc')) ? 'Optional allocated budget for Miscellaneous (No set budget required)' : (isEdit && (cat.id === 'cat-daily' || cat.name.toLowerCase().includes('allowance')) ? 'Sets the base allowance for your Daily Tracker' : `Allocated portion of your ${cutoffLabel} spend budget (${formatCurrency(plan.spendBudget, curr)})`))}
            </small>
          </div>
          <div class="quick-amount-presets" style="margin-bottom: 0.85rem;">
            <button type="button" class="preset-chip" data-v="500">+500</button>
            <button type="button" class="preset-chip" data-v="1000">+1,000</button>
            <button type="button" class="preset-chip" data-v="2000">+2,000</button>
          </div>

          <!-- Dynamic Overbudget Alert Container -->
          <div id="limit-error-alert" style="display: none; padding: 0.65rem 0.8rem; background: rgba(255, 235, 237, 0.95); border: 1.5px solid var(--coral-alert); border-radius: var(--radius-sm); color: #B91C1C; font-size: 0.76rem; line-height: 1.35; margin-bottom: 1rem;"></div>
          
          <div style="display: flex; gap: 0.5rem;">
            ${isEdit && (!cat.id || !cat.id.startsWith('cat-income')) ? `
              <button type="button" class="btn btn-danger squish-btn" id="env-delete-btn" style="flex: 1; padding: 0.85rem;">
                Delete
              </button>
            ` : ''}
            <button type="submit" id="limit-save-btn" class="btn btn-primary squish-btn" style="flex: ${isEdit ? '2' : '1'}; padding: 0.85rem;">
              Save Allocation
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

    // Calculate remaining unallocated budget for this cutoff excluding current category
    const catSpendings = store.getCutoffCategorySpending(activeCutoff);
    const otherAllocations = catSpendings
      .filter(c => !c.name.toLowerCase().includes('income') && (!isEdit || c.id !== cat.id))
      .reduce((sum, c) => sum + (c.period_limit || 0), 0);
    const maxAllowedForThisEnv = Math.max(0, (plan.spendBudget || 0) - otherAllocations);

    const input = backdrop.querySelector('#limit-val');
    const errorAlertEl = backdrop.querySelector('#limit-error-alert');
    const submitBtn = backdrop.querySelector('#limit-save-btn');

    function validateLimitInput() {
      if (!input || !errorAlertEl || !submitBtn) return;
      const val = Math.round(parseFloat(input.value) || 0);

      if (!hasSpendBudget) {
        if (val > 0) {
          errorAlertEl.style.display = 'block';
          errorAlertEl.innerHTML = `
            <strong>⚠️ Cannot Allocate:</strong> No spend budget set for ${cutoffLabel} (${curr} 0). You cannot allocate money to envelopes until you set a budget in the Blueprint.
          `;
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        } else {
          errorAlertEl.style.display = 'none';
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
        return;
      }

      if (val > maxAllowedForThisEnv) {
        const excess = val - maxAllowedForThisEnv;
        errorAlertEl.style.display = 'block';
        errorAlertEl.innerHTML = `
          <strong>⚠️ Overbudget Allocation:</strong> You only have <strong>${formatCurrency(maxAllowedForThisEnv, curr)}</strong> unallocated in your current ${cutoffLabel} spend budget (${formatCurrency(plan.spendBudget, curr)}). Setting this allocation to <strong>${formatCurrency(val, curr)}</strong> exceeds it by <strong>${formatCurrency(excess, curr)}</strong> and cannot be saved.
        `;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
      } else {
        errorAlertEl.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }

    if (input) {
      input.addEventListener('input', validateLimitInput);
      validateLimitInput();
    }

    backdrop.querySelectorAll('.preset-chip').forEach(btn => {
      btn.onclick = () => {
        playPop();
        if (!hasSpendBudget) {
          showToast({ text: `Cannot allocate: Set your cutoff budget in Blueprint first.` });
          return;
        }
        if (input) {
          const currentVal = parseFloat(input.value) || 0;
          input.value = Math.round(currentVal + parseFloat(btn.dataset.v)).toString();
          validateLimitInput();
        }
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
      const val = Math.round(parseFloat(input ? input.value : 0) || 0);
      const nameVal = (backdrop.querySelector('#env-name')?.value || '').trim();
      if (!nameVal) return;

      if (!hasSpendBudget && val > 0) {
        playPop();
        showToast({ text: `Cannot allocate: No spend budget set for ${cutoffLabel}. Please set your budget in Blueprint first.` });
        return;
      }

      if (hasSpendBudget && val > maxAllowedForThisEnv) {
        playPop();
        showToast({ text: `Cannot allocate: Exceeds unallocated cutoff budget (${formatCurrency(maxAllowedForThisEnv, curr)})!` });
        return;
      }

      let targetCatId;
      if (isEdit) {
        targetCatId = cat.id;
        store.updateCategory(cat.id, { name: nameVal });
      } else {
        const newCat = store.addCategory({ name: nameVal, monthly_limit: val * 2 });
        targetCatId = newCat.id;
      }
      
      if (isSemi && activeCutoff) {
        store.updateCutoffCategoryLimit(activeCutoff.id, targetCatId, val);
      } else {
        store.updateCategory(targetCatId, { monthly_limit: val });
      }
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

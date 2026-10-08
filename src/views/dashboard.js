// ====================================================================
// CLOUDY BUDGET - DASHBOARD VIEW
// Semi-monthly payday budgeting, week calendar strip, daily safe spend,
// and cute interactive mascot companion.
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, stripEmojis } from '../lib/format.js';
import { renderMascot } from '../components/mascot.js';
import { renderPaydayCard } from '../components/paydayCard.js';
import { renderWeekStrip } from '../components/weekStrip.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { playPop, playCoin } from '../lib/audio.js';
import { showToast } from '../components/toast.js';
import { ICONS, getCategoryIconSvg } from '../lib/icons.js';

export function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'dashboard-view anim-fade-in';

  const settings = store.getSettings();
  const curr = settings.currency || '₱';
  const isSemi = (settings.payCycle || 'semi-monthly') === 'semi-monthly';

  // Current Period / Cutoff Summary
  const curCutoff = store.getCurrentCutoff();
  const summary = isSemi ? store.getCutoffSummary(curCutoff) : store.getMonthSummary();
  const todayInfo = store.getTodayAllowance();

  // 1. Payday Alert Banner (shown only when a payday is ready to confirm)
  const paydayBanner = renderPaydayCard();
  if (paydayBanner) {
    container.appendChild(paydayBanner);
  }

  // 2. Week Strip Calendar (Monday - Sunday with status dots & coins)
  const weekStrip = renderWeekStrip();
  container.appendChild(weekStrip);

  // Tight Budget Warning Banner
  if (summary.budgetLimit > 0 && summary.isTight) {
    const tightBanner = document.createElement('div');
    tightBanner.className = 'cloud-card budget-tight-banner anim-fade-in';
    tightBanner.style.cssText = `
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, rgba(255, 251, 230, 0.98) 0%, rgba(255, 241, 184, 0.95) 100%);
      border: 1.5px solid #FFD666;
      border-radius: var(--radius-md);
      box-shadow: 0 2px 10px rgba(230, 168, 0, 0.12);
    `;
    tightBanner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #D48806; display: flex; width: 22px; height: 22px;">${ICONS.alertTriangle}</span>
          <div>
            <div style="font-size: 0.72rem; font-weight: 800; color: #B38300; text-transform: uppercase; letter-spacing: 0.04em;">Tight Budget Warning</div>
            <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
              Only ${formatCurrency(summary.remainingBudget, curr)} remaining to spend
            </div>
          </div>
        </div>
        <span class="pill" style="background: #FAAD14; color: #FFF; font-weight: 800; font-size: 0.72rem;">${Math.round(summary.usagePercent)}% Used</span>
      </div>
      <div style="font-size: 0.74rem; color: #8C6D00; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
        <span style="width: 14px; height: 14px; display: inline-flex;">${ICONS.shield}</span>
        <span>Cutoff ${summary.cutoff ? summary.cutoff.label : ''} &bull; Savings of ${formatCurrency(summary.plan ? summary.plan.savingsTarget : 0, curr)} is strictly protected.</span>
      </div>
    `;
    container.appendChild(tightBanner);
  } else if (summary.budgetLimit > 0 && summary.isExhausted) {
    const exhaustedBanner = document.createElement('div');
    exhaustedBanner.className = 'cloud-card anim-fade-in';
    exhaustedBanner.style.cssText = `
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, rgba(255, 235, 237, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
      border: 1.5px solid var(--coral-alert);
      border-radius: var(--radius-md);
    `;
    exhaustedBanner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="color: var(--coral-alert); display: flex; width: 22px; height: 22px;">${ICONS.alertTriangle}</span>
        <div>
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--coral-alert); text-transform: uppercase; letter-spacing: 0.04em;">Spend Budget Reached</div>
          <div style="font-size: 0.84rem; font-weight: 800; color: var(--text-main);">
            Spend budget is ${formatCurrency(0, curr)}. Further expenses cannot be logged to prevent touching savings.
          </div>
        </div>
      </div>
    `;
    container.appendChild(exhaustedBanner);
  }

  // 3. "Today You Can Still Spend" Hero Card (from Approved Mockup)
  const todayCard = document.createElement('div');
  todayCard.className = 'cloud-card today-allowance-card';
  todayCard.style.cssText = `
    padding: 1.35rem 1.25rem;
    margin-bottom: 1.25rem;
    text-align: center;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 248, 255, 0.95) 100%);
    border: 2px solid var(--sky-200);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    position: relative;
  `;

  // Calculate today usage percent
  const todaySpent = todayInfo.spentToday || 0;
  const todayTarget = todayInfo.todayAllowance || 1;
  const todayUsageRatio = todayTarget > 0 ? (todaySpent / todayTarget) : 0;
  const todayStatusClass = todayUsageRatio > 1 ? 'status-danger' : todayUsageRatio >= 0.8 ? 'status-warn' : 'status-safe';

  todayCard.innerHTML = `
    <div style="font-size: 0.76rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
      Today you can still spend
    </div>
    <div style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 800; color: var(--primary); margin: 0.15rem 0 0.35rem 0; line-height: 1.1;">
      ${formatCurrency(todayInfo.todayLeft, curr)}
    </div>
    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.85rem;">
      Spent ${formatCurrency(todaySpent, curr)} of ${formatCurrency(todayInfo.todayAllowance, curr)} daily allowance
    </div>

    <!-- Mini Progress Ring / Meter -->
    <div class="cloud-progress" style="height: 9px; max-width: 280px; margin: 0 auto 0.75rem auto;">
      <div class="cloud-progress-fill ${todayStatusClass}" style="width: ${Math.min(100, Math.round(todayUsageRatio * 100))}%;"></div>
    </div>

    <!-- Countdown to Next Payday -->
    ${todayInfo.daysToPayday ? `
      <div style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 0.3rem; margin-bottom: 0.85rem;">
        <span>${todayInfo.daysToPayday === 1 ? 'Payday is tomorrow!' : `${todayInfo.daysToPayday} days until payday`}</span>
        <span style="display: inline-flex; width: 13px; height: 13px;">${ICONS.coin}</span>
      </div>
    ` : '<div style="margin-bottom: 0.85rem;"></div>'}

    <!-- Action Buttons specifically inside this widget -->
    <div style="display: flex; gap: 0.6rem; justify-content: center; max-width: 320px; margin: 0 auto;">
      <button id="today-add-expense-btn" class="squish-btn" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem 0.9rem; border: 1.5px solid rgba(255, 123, 137, 0.35); border-radius: var(--radius-full); background: rgba(255, 123, 137, 0.12); color: var(--coral-alert); font-weight: 800; font-size: 0.84rem; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.15s ease;">
        <span style="font-size: 1.05rem; line-height: 1; font-weight: 900;">-</span> Log Expense
      </button>
      <button id="today-add-income-btn" class="squish-btn" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem 0.9rem; border: 1.5px solid rgba(86, 193, 144, 0.35); border-radius: var(--radius-full); background: rgba(86, 193, 144, 0.12); color: var(--mint-deep); font-weight: 800; font-size: 0.84rem; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.15s ease;">
        <span style="font-size: 1.05rem; line-height: 1; font-weight: 900;">+</span> Log Income
      </button>
    </div>
  `;

  todayCard.querySelector('#today-add-expense-btn').onclick = () => {
    playPop();
    openQuickAddModal('expense');
  };
  todayCard.querySelector('#today-add-income-btn').onclick = () => {
    playPop();
    openQuickAddModal('income');
  };

  container.appendChild(todayCard);

  // 4. Period Balance Hero Card (with mascot companion)
  const heroCard = document.createElement('div');
  heroCard.className = 'hero-card';
  heroCard.style.marginBottom = '1.25rem';

  const periodLabel = isSemi
    ? `${curCutoff.label} Remaining`
    : `${new Date().toLocaleDateString('en-US', { month: 'long' })} Remaining`;

  const heroInfo = document.createElement('div');
  heroInfo.innerHTML = `
    <div class="balance-label">
      ${ICONS.wallet} ${periodLabel}
    </div>
    <div class="balance-amount" style="margin: 0.1rem 0 0.45rem 0;">
      ${formatCurrency(summary.remainingBudget, curr)}
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.55rem;">
      <span>${formatCurrency(summary.budgetLimit, curr)} <span style="font-weight:500">${summary.plan?.isExpected ? 'spend cap' : 'income spend cap'}</span></span>
      <span>${Math.round(summary.usagePercent)}% used</span>
    </div>

    <div class="cloud-progress" style="margin-bottom: 0.85rem;">
      <div class="cloud-progress-fill ${
        summary.usagePercent > 100 ? 'status-danger' : summary.usagePercent >= 75 ? 'status-warn' : 'status-safe'
      }" style="width: ${Math.min(100, Math.round(summary.usagePercent))}%;"></div>
    </div>

    <div class="balance-stats">
      <div class="stat-pill">
        <span class="stat-pill-label" style="color: var(--mint-deep);">${ICONS.arrowDownLeft} Income</span>
        <span class="stat-pill-val val-income">+${formatCurrency(summary.totalIncome, curr)}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-label" style="color: var(--coral-alert);">${ICONS.arrowUpRight} Spent</span>
        <span class="stat-pill-val val-expense">-${formatCurrency(summary.totalExpense, curr)}</span>
      </div>
    </div>
  `;

  // Render dynamic mascot based on mood
  const mascotWidget = renderMascot({ mood: summary.mood });

  heroCard.appendChild(heroInfo);
  heroCard.appendChild(mascotWidget);
  container.appendChild(heroCard);

  // 6. Category Budgets Snapshot (for current cutoff)
  const categoryCard = document.createElement('div');
  categoryCard.className = 'cloud-card';
  categoryCard.style.marginBottom = '1.75rem';

  const catSpendings = isSemi
    ? store.getCutoffCategorySpending(curCutoff).slice(0, 4)
    : store.getCategorySpending().slice(0, 4);

  categoryCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
        ${ICONS.pieChart} ${isSemi ? 'Cutoff Spending' : 'Spending'}
      </h3>
      <button class="pill squish-btn" id="view-all-cats-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">Planner →</button>
    </div>
    <div class="cat-list-box" style="display: flex; flex-direction: column; gap: 0.85rem;">
      ${
        catSpendings.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 1rem;">No expenses yet logged this period</p>'
          : catSpendings
              .map(c => {
                const limit = isSemi ? (c.period_limit || 0) : (c.monthly_limit || 0);
                return `
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.86rem; font-weight: 700; margin-bottom: 0.35rem;">
                      <span style="display: flex; align-items: center; gap: 0.4rem;">
                        <span style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; color: var(--primary);">${getCategoryIconSvg(c.id || c.name)}</span>
                        ${c.name.split(' ')[0]}
                      </span>
                      <span>${formatCurrency(c.spent, curr)}<span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;"> / ${limit > 0 ? formatCurrency(limit, curr) : '∞'}</span></span>
                    </div>
                    <div class="cloud-progress" style="height: 8px;">
                      <div class="cloud-progress-fill ${
                        c.percent > 100 ? 'status-danger' : c.percent >= 80 ? 'status-warn' : 'status-safe'
                      }" style="width: ${Math.min(100, Math.round(c.percent))}%;"></div>
                    </div>
                  </div>
                `;
              }).join('')
      }
    </div>
  `;

  categoryCard.querySelector('#view-all-cats-btn').onclick = () => {
    window.location.hash = '#planner';
  };
  container.appendChild(categoryCard);

  // 7. Upcoming Bills & Subscriptions Alert
  const recurring = store.getRecurring();
  if (recurring.length > 0) {
    const recurringCard = document.createElement('div');
    recurringCard.className = 'cloud-card';
    recurringCard.style.marginBottom = '1.75rem';

    // Sort: unpaid bills first, then sorted by nextDue
    const sortedRecurring = [...recurring].sort((a, b) => {
      const aPaid = store.isRecurringPaidThisMonth(a);
      const bPaid = store.isRecurringPaidThisMonth(b);
      if (aPaid !== bPaid) return aPaid ? 1 : -1;
      return new Date(a.nextDue || 0) - new Date(b.nextDue || 0);
    });

    recurringCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          ${ICONS.repeat} Upcoming Bills
        </h3>
        <button class="pill squish-btn" id="view-all-bills-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">Manage →</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${sortedRecurring.slice(0, 3).map(r => {
          const isPaid = store.isRecurringPaidThisMonth(r);
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-cloud); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">${r.name}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  ${isPaid ? 'Next Due' : 'Due'}: ${formatDate(r.nextDue)}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-weight: 800; font-family: var(--font-display);">${formatCurrency(r.amount, curr)}</span>
                ${isPaid ? `
                  <span class="bill-pill bill-pill-paid">
                    ${ICONS.check} Paid
                  </span>
                ` : `
                  <button class="bill-pill bill-pill-btn squish-btn bill-pay-quick-btn" data-id="${r.id}">
                    Pay
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    recurringCard.querySelector('#view-all-bills-btn').onclick = () => {
      window.location.hash = '#bills';
    };

    recurringCard.querySelectorAll('.bill-pay-quick-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        playCoin();
        const id = btn.dataset.id;
        store.markRecurringPaid(id);
        showToast({ text: 'Bill marked as paid & logged!', icon: 'check' });
      };
    });

    container.appendChild(recurringCard);
  }

  // 8. Recent Transactions
  const txCard = document.createElement('div');
  txCard.className = 'cloud-card';
  const recentTx = store.getTransactions().slice(0, 5);

  txCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
        ${ICONS.clock} Recent
      </h3>
      <button class="pill squish-btn" id="view-all-tx-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">All →</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
      ${
        recentTx.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 1.5rem;">No transactions yet. Tap + to start.</p>'
          : recentTx
              .map(t => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.9rem; border-radius: var(--radius-md); background: var(--bg-card-cloud); border: 1px solid var(--border-color); transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                ${getCategoryIconSvg(t.categoryId || t.categoryName)}
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${stripEmojis(t.note) || stripEmojis(t.categoryName)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(t.date)} &bull; ${stripEmojis(t.categoryName)}</div>
              </div>
            </div>
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 1rem; color: ${
              t.type === 'income' ? 'var(--mint-deep)' : 'var(--text-main)'
            };">
              ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, curr)}
            </div>
          </div>
        `).join('')
      }
    </div>
  `;

  txCard.querySelector('#view-all-tx-btn').onclick = () => {
    window.location.hash = '#transactions';
  };
  container.appendChild(txCard);

  return container;
}

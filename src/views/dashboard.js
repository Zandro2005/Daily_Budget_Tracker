// ====================================================================
// CLOUDY BUDGET - DASHBOARD VIEW
// Semi-monthly payday budgeting, week calendar strip, daily safe spend,
// and cute interactive mascot companion.
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, stripEmojis } from '../lib/format.js';
import { renderMascot } from '../components/mascot.js';
import { renderPaydayCard } from '../components/paydayCard.js';
import { playPop } from '../lib/audio.js';
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


  // 1. Payday Alert Banner (shown only when a payday is ready to confirm)
  const paydayBanner = renderPaydayCard();
  if (paydayBanner) {
    container.appendChild(paydayBanner);
  }



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

    <div class="balance-stats" style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1.15rem;">
      <!-- Featured Bigger Income Widget -->
      <div class="stat-pill" style="padding: 0.85rem 1rem; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(86, 193, 144, 0.12) 0%, rgba(86, 193, 144, 0.04) 100%); border: 1.5px solid rgba(86, 193, 144, 0.35); box-shadow: 0 3px 10px rgba(86, 193, 144, 0.08); display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
        <div>
          <span class="stat-pill-label" style="color: var(--mint-deep); font-size: 0.82rem; font-weight: 800; gap: 0.35rem; letter-spacing: 0.02em;">
            <span style="display: inline-flex; width: 16px; height: 16px;">${ICONS.arrowDownLeft}</span> Total Income
          </span>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-top: 0.15rem;">Cutoff Inflow</div>
        </div>
        <span class="stat-pill-val val-income" style="font-size: 1.45rem; font-weight: 800; font-family: var(--font-display); letter-spacing: -0.5px;">
          +${formatCurrency(summary.totalIncome, curr)}
        </span>
      </div>

      <!-- Smaller, Clean Side-by-Side Spent & Saved -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
        <div class="stat-pill" style="padding: 0.65rem 0.75rem; border-radius: var(--radius-md); background: rgba(255, 123, 137, 0.06); border: 1px solid rgba(255, 123, 137, 0.22);">
          <span class="stat-pill-label" style="color: var(--coral-alert); font-size: 0.72rem; font-weight: 700; gap: 0.25rem;">
            <span style="display: inline-flex; width: 13px; height: 13px;">${ICONS.arrowUpRight}</span> Spent
          </span>
          <span class="stat-pill-val val-expense" style="font-size: 1.05rem; font-weight: 800; margin-top: 0.2rem; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            -${formatCurrency(summary.totalExpense, curr)}
          </span>
        </div>

        <div class="stat-pill" style="padding: 0.65rem 0.75rem; border-radius: var(--radius-md); background: rgba(85, 168, 232, 0.06); border: 1px solid rgba(85, 168, 232, 0.22);">
          <span class="stat-pill-label" style="color: var(--sky-500); font-size: 0.72rem; font-weight: 700; gap: 0.25rem;">
            <span style="display: inline-flex; width: 13px; height: 13px;">${ICONS.shield}</span> Saved
          </span>
          <span class="stat-pill-val" style="color: var(--sky-600); font-size: 1.05rem; font-weight: 800; margin-top: 0.2rem; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${formatCurrency(summary.plan?.savingsTarget || 0, curr)}
          </span>
        </div>
      </div>
    </div>
  `;

  // Render dynamic mascot based on mood
  const mascotWidget = renderMascot({ mood: summary.mood });

  heroCard.appendChild(heroInfo);
  heroCard.appendChild(mascotWidget);

  container.appendChild(heroCard);



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

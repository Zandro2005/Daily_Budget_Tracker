// ====================================================================
// CLOUDY BUDGET - DASHBOARD VIEW
// Semi-monthly payday budgeting, week calendar strip, daily safe spend,
// and cute interactive mascot companion.
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, stripEmojis, escapeHtml } from '../lib/format.js';
import { renderMascot } from '../components/mascot.js';
import { renderPaydayCard } from '../components/paydayCard.js';
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

  // 2. Period Balance Hero Card (with mascot companion)
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

      <!-- Clean Side-by-Side Spent & Saved -->
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

  // 3. Recent Transactions Card
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
                <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${escapeHtml(stripEmojis(t.note) || stripEmojis(t.categoryName))}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                  <span>${formatDate(t.date)} &bull; ${escapeHtml(stripEmojis(t.categoryName))}</span>
                  ${(t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))) ? `
                    <span class="pill" style="padding: 0.05rem 0.35rem; font-size: 0.65rem; font-weight: 800; background: ${t.loanStatus === 'repaid' ? 'rgba(86,193,144,0.15)' : 'rgba(255,171,0,0.15)'}; color: ${t.loanStatus === 'repaid' ? 'var(--mint-deep)' : '#B37400'}; border: 1px solid ${t.loanStatus === 'repaid' ? 'rgba(86,193,144,0.4)' : 'rgba(255,171,0,0.4)'};">
                      ${t.loanStatus === 'repaid' ? '✓ Repaid' : '🤝 Hiram'}
                    </span>
                  ` : ''}
                </div>
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

  // 6. Hiram / Money Lent Widget (Shown under Recent Activity - persists across cutoffs until deleted)
  const loansCard = document.createElement('div');
  loansCard.className = 'cloud-card anim-fade-in';
  loansCard.style.marginTop = '1.15rem';

  const loans = store.getAllLoans ? store.getAllLoans() : [];
  const totalUnpaid = loans.filter(l => l.loanStatus !== 'repaid').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const unpaidCount = loans.filter(l => l.loanStatus !== 'repaid').length;

  loansCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
          🤝 Money Lent (Hiram)
        </h3>
        ${unpaidCount > 0 ? `
          <span class="pill" style="font-size: 0.72rem; font-weight: 700; background: rgba(255,171,0,0.15); color: #B37400; padding: 0.15rem 0.45rem;">
            ${unpaidCount} Active
          </span>
        ` : ''}
      </div>
      ${loans.length > 0 ? `
        <span class="pill" style="font-size: 0.74rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); background: ${totalUnpaid > 0 ? 'rgba(255,171,0,0.15)' : 'rgba(86,193,144,0.15)'}; color: ${totalUnpaid > 0 ? '#B37400' : 'var(--mint-deep)'}; border: 1px solid ${totalUnpaid > 0 ? 'rgba(255,171,0,0.4)' : 'rgba(86,193,144,0.4)'};">
          ${totalUnpaid > 0 ? `${formatCurrency(totalUnpaid, curr)} pending` : 'All Repaid ✓'}
        </span>
      ` : ''}
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
      ${loans.length === 0 ? `
        <p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 1.5rem 0.5rem; margin: 0;">
          No money lent out. Tap + to record hiram.
        </p>
      ` : loans.map(l => {
        const isRepaid = l.loanStatus === 'repaid';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0.9rem; background: var(--bg-card-cloud); border-radius: var(--radius-md); border: 1px solid var(--border-color); gap: 0.65rem; transition: all 0.2s ease;">
            <div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">
                ${escapeHtml(l.borrowerName || l.note || 'Someone')}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                <span>Borrowed: <strong>${formatDate(l.date)}</strong></span>
                ${l.cutoffLabel ? `<span>&bull;</span> <span>${escapeHtml(l.cutoffLabel)}</span>` : ''}
                <span>&bull;</span>
                <span>Deducted from: <span class="pill" style="padding: 0.05rem 0.35rem; font-size: 0.68rem; background: var(--sky-100); color: var(--primary); font-weight: 700;">${escapeHtml(l.categoryName || 'Cutoff Allowance')}</span></span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
              <strong style="font-family: var(--font-display); font-size: 1rem; color: ${isRepaid ? 'var(--mint-deep)' : 'var(--text-main)'};">
                ${formatCurrency(l.amount, curr)}
              </strong>
              ${isRepaid ? `
                <span class="pill" style="font-size: 0.68rem; font-weight: 800; background: rgba(86,193,144,0.15); color: var(--mint-deep); padding: 0.2rem 0.45rem; border: 1px solid rgba(86,193,144,0.4);">Repaid</span>
                <button class="icon-btn squish-btn dash-del-loan-btn" data-id="${l.id}" title="Delete Repaid Record" style="width: 28px; height: 28px; color: var(--coral-alert); background: rgba(255,123,137,0.1); border: none; border-radius: var(--radius-full); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
                  <span style="display: flex; width: 14px; height: 14px;">${ICONS.trash}</span>
                </button>
              ` : `
                <button class="btn btn-sm squish-btn dash-repay-btn" data-id="${l.id}" style="padding: 0.28rem 0.65rem; font-size: 0.72rem; font-weight: 800; border-radius: var(--radius-full); background: var(--mint-deep); color: white; border: none; cursor: pointer;">
                  Mark Paid
                </button>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  loansCard.querySelectorAll('.dash-del-loan-btn').forEach(btn => {
    btn.onclick = () => {
      playPop();
      const id = btn.dataset.id;
      if (confirm('Delete this repaid hiram record?')) {
        store.deleteTransaction(id);
        showToast({ text: 'Repaid record deleted', icon: 'trash' });
        const newDash = renderDashboard();
        container.replaceWith(newDash);
      }
    };
  });

  loansCard.querySelectorAll('.dash-repay-btn').forEach(btn => {
    btn.onclick = () => {
      playPop();
      const id = btn.dataset.id;
      const res = store.repayLoan(id);
      if (res) {
        playCoin();
        showToast({ text: `${res.originalTx.borrowerName || 'Borrower'} paid back ${formatCurrency(res.originalTx.amount, curr)}!`, icon: 'check' });
        const newDash = renderDashboard();
        container.replaceWith(newDash);
      }
    };
  });

  container.appendChild(loansCard);

  return container;
}


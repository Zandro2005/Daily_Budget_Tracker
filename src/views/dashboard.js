// ====================================================================
// CLOUDY BUDGET - DASHBOARD VIEW
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, formatDate, getCurrentMonthKey } from '../lib/format.js';
import { renderMascot } from '../components/mascot.js';
import { openQuickAddModal } from '../components/quickAddModal.js';
import { playPop, playCoin } from '../lib/audio.js';
import { showToast } from '../components/toast.js';

export function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'dashboard-view anim-fade-in';

  const summary = store.getMonthSummary();
  const settings = store.getSettings();
  const curr = settings.currency;

  // 1. Hero Card with Balance + Cloud Mascot
  const heroCard = document.createElement('div');
  heroCard.className = 'hero-card';

  const heroInfo = document.createElement('div');
  heroInfo.innerHTML = `
    <div class="balance-label">
      ☁️ ${new Date().toLocaleDateString('en-US', { month: 'long' })} Remaining
    </div>
    <div class="balance-amount" style="margin: 0.1rem 0 0.45rem 0;">${formatCurrency(summary.remainingBudget, curr)}</div>
    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.55rem;">
      <span>${formatCurrency(store.getDailyAllowance().dailySafeSpend, curr)}<span style="font-weight:500">/day safe</span></span>
      <span>${Math.round(summary.usagePercent)}% used</span>
    </div>

    <div class="cloud-progress" style="margin-bottom: 0.85rem;">
      <div class="cloud-progress-fill ${
        summary.usagePercent > 100 ? 'status-danger' : summary.usagePercent >= 75 ? 'status-warn' : 'status-safe'
      }" style="width: ${Math.min(100, Math.round(summary.usagePercent))}%;"></div>
    </div>

    <div class="balance-stats">
      <div class="stat-pill">
        <span class="stat-pill-label">🌱 Income</span>
        <span class="stat-pill-val val-income">+${formatCurrency(summary.totalIncome, curr)}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-label">💸 Spent</span>
        <span class="stat-pill-val val-expense">-${formatCurrency(summary.totalExpense, curr)}</span>
      </div>
    </div>
  `;

  // Render dynamic mascot based on mood
  const mascotWidget = renderMascot({ mood: summary.mood });

  heroCard.appendChild(heroInfo);
  heroCard.appendChild(mascotWidget);
  container.appendChild(heroCard);

  // 2. Compact Rounded Action Row (No scroll mistouch)
  const actionRow = document.createElement('div');
  actionRow.style.cssText = 'display: flex; gap: 0.65rem; margin-bottom: 1.25rem;';
  actionRow.innerHTML = `
    <button class="squish-btn" id="dash-quick-add" style="flex: 1; padding: 0.55rem 0.85rem; border-radius: 9999px; border: 1.5px solid rgba(255, 255, 255, 0.9); background: linear-gradient(135deg, #FF8E9E 0%, #FF6B7D 100%); color: #FFF; font-family: var(--font-display); font-size: 0.86rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; box-shadow: 0 4px 12px -2px rgba(255, 107, 125, 0.35); transition: all 0.15s ease;">
      <span style="font-size: 1rem;">💸</span> Log Expense
    </button>
    <button class="squish-btn" id="dash-quick-income" style="flex: 1; padding: 0.55rem 0.85rem; border-radius: 9999px; border: 1.5px solid rgba(255, 255, 255, 0.9); background: linear-gradient(135deg, #5CD69D 0%, #3DB87E 100%); color: #FFF; font-family: var(--font-display); font-size: 0.86rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; box-shadow: 0 4px 12px -2px rgba(61, 184, 126, 0.35); transition: all 0.15s ease;">
      <span style="font-size: 1rem;">💰</span> Log Income
    </button>
  `;

  const addExpenseBtn = actionRow.querySelector('#dash-quick-add');
  const addIncomeBtn = actionRow.querySelector('#dash-quick-income');

  addExpenseBtn.onclick = () => {
    playPop();
    openQuickAddModal('expense');
  };

  addIncomeBtn.onclick = () => {
    playPop();
    openQuickAddModal('income');
  };

  container.appendChild(actionRow);

  // 3. Category Budgets Snapshot
  const categoryCard = document.createElement('div');
  categoryCard.className = 'cloud-card';
  categoryCard.style.marginBottom = '1.75rem';

  const catSpendings = store.getCategorySpending().slice(0, 4);

  categoryCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;">🗂️ Spending</h3>
      <button class="pill squish-btn" id="view-all-cats-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">Planner →</button>
    </div>
    <div class="cat-list-box" style="display: flex; flex-direction: column; gap: 0.85rem;">
      ${
        catSpendings.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 1rem;">No expenses yet 🌸</p>'
          : catSpendings
              .map(c => `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.86rem; font-weight: 700; margin-bottom: 0.3rem;">
              <span>${c.emoji} ${c.name.split(' ')[0]}</span>
              <span>${formatCurrency(c.spent, curr)}<span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;"> / ${c.monthly_limit > 0 ? formatCurrency(c.monthly_limit, curr) : '∞'}</span></span>
            </div>
            <div class="cloud-progress" style="height: 8px;">
              <div class="cloud-progress-fill ${
                c.percent > 100 ? 'status-danger' : c.percent >= 80 ? 'status-warn' : 'status-safe'
              }" style="width: ${Math.min(100, Math.round(c.percent))}%;"></div>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;

  categoryCard.querySelector('#view-all-cats-btn').onclick = () => {
    window.location.hash = '#planner';
  };
  container.appendChild(categoryCard);

  // 4. Upcoming Bills & Subscriptions Alert
  const recurring = store.getRecurring();
  if (recurring.length > 0) {
    const recurringCard = document.createElement('div');
    recurringCard.className = 'cloud-card';
    recurringCard.style.marginBottom = '1.75rem';
    recurringCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;">🔁 Upcoming Bills</h3>
        <button class="pill squish-btn" id="view-all-bills-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">Manage →</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${recurring.slice(0, 3).map(r => `
          <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card-cloud); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div>
              <div style="font-weight: 700; font-size: 0.95rem;">${r.name}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Due: ${formatDate(r.nextDue)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-weight: 800; font-family: var(--font-display);">${formatCurrency(r.amount, curr)}</span>
              <button class="btn btn-primary btn-sm squish-btn bill-pay-quick-btn" data-id="${r.id}">
                Paid ✓
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    recurringCard.querySelector('#view-all-bills-btn').onclick = () => {
      window.location.hash = '#bills';
    };

    recurringCard.querySelectorAll('.bill-pay-quick-btn').forEach(btn => {
      btn.onclick = () => {
        playCoin();
        const id = btn.dataset.id;
        store.markRecurringPaid(id);
        showToast({ text: 'Bill marked as paid & logged! ⚡', icon: '✨' });
      };
    });

    container.appendChild(recurringCard);
  }

  // 5. Recent Transactions
  const txCard = document.createElement('div');
  txCard.className = 'cloud-card';
  const recentTx = store.getTransactions().slice(0, 5);

  txCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem; font-weight: 700;">📝 Recent</h3>
      <button class="pill squish-btn" id="view-all-tx-btn" style="cursor: pointer; border: none; font-size: 0.75rem;">All →</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
      ${
        recentTx.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 1.5rem;">No transactions yet! Tap + to start. ☁️</p>'
          : recentTx
              .map(t => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.9rem; border-radius: var(--radius-md); background: var(--bg-card-cloud); border: 1px solid var(--border-color); transition: all 0.2s ease;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background: var(--sky-100); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                ${t.categoryEmoji || '🏷️'}
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${t.note || t.categoryName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(t.date)} &bull; ${t.categoryName}</div>
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

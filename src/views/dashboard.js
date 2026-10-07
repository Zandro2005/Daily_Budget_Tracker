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
      <span>☁️</span> ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Budget
    </div>
    <div class="balance-amount">${formatCurrency(summary.remainingBudget, curr)}</div>
    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.25rem;">
      <span>Remaining of ${formatCurrency(summary.budgetLimit, curr)} cap</span>
      <span style="color: var(--primary); background: var(--sky-100); padding: 0.15rem 0.5rem; border-radius: var(--radius-full);">Safe: ${formatCurrency(store.getDailyAllowance().dailySafeSpend, curr)}/day</span>
    </div>

    <!-- Overall Budget Bar -->
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem;">
        <span>Spent: ${Math.round(summary.usagePercent)}%</span>
        <span>${formatCurrency(summary.totalExpense, curr)}</span>
      </div>
      <div class="cloud-progress">
        <div class="cloud-progress-fill ${
          summary.usagePercent > 100 ? 'status-danger' : summary.usagePercent >= 75 ? 'status-warn' : 'status-safe'
        }" style="width: ${Math.min(100, Math.round(summary.usagePercent))}%;"></div>
      </div>
    </div>

    <!-- Income & Expense mini pills -->
    <div class="balance-stats">
      <div class="stat-pill">
        <span class="stat-pill-label"><span>🌱</span> Income</span>
        <span class="stat-pill-val val-income">+${formatCurrency(summary.totalIncome, curr)}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-label"><span>💸</span> Spent</span>
        <span class="stat-pill-val val-expense">-${formatCurrency(summary.totalExpense, curr)}</span>
      </div>
    </div>
  `;

  // Render dynamic mascot based on mood
  const mascotWidget = renderMascot({ mood: summary.mood });

  heroCard.appendChild(heroInfo);
  heroCard.appendChild(mascotWidget);
  container.appendChild(heroCard);

  // 2. Interactive Rounded Action Row
  const actionRow = document.createElement('div');
  actionRow.style.cssText = 'display: flex; gap: 0.85rem; margin-bottom: 1.5rem;';
  actionRow.innerHTML = `
    <button class="squish-btn" id="dash-quick-add" style="flex: 1; padding: 0.95rem 1rem; border-radius: 9999px; border: 2px solid rgba(255, 255, 255, 0.8); background: linear-gradient(135deg, #FF8E9E 0%, #FF6B7D 100%); color: #FFF; font-family: var(--font-display); font-size: 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 8px 20px -3px rgba(255, 107, 125, 0.45); transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <span style="font-size: 1.25rem;">💸</span> Log Expense
    </button>
    <button class="squish-btn" id="dash-quick-income" style="flex: 1; padding: 0.95rem 1rem; border-radius: 9999px; border: 2px solid rgba(255, 255, 255, 0.8); background: linear-gradient(135deg, #5CD69D 0%, #3DB87E 100%); color: #FFF; font-family: var(--font-display); font-size: 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 8px 20px -3px rgba(61, 184, 126, 0.45); transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <span style="font-size: 1.25rem;">💰</span> Log Income
    </button>
  `;

  const addExpenseBtn = actionRow.querySelector('#dash-quick-add');
  const addIncomeBtn = actionRow.querySelector('#dash-quick-income');

  const handleExpenseClick = (e) => {
    e.preventDefault();
    playPop();
    openQuickAddModal('expense');
  };

  const handleIncomeClick = (e) => {
    e.preventDefault();
    playPop();
    openQuickAddModal('income');
  };

  addExpenseBtn.addEventListener('click', handleExpenseClick);
  addExpenseBtn.addEventListener('touchend', handleExpenseClick);

  addIncomeBtn.addEventListener('click', handleIncomeClick);
  addIncomeBtn.addEventListener('touchend', handleIncomeClick);

  container.appendChild(actionRow);

  // 3. Category Budgets Snapshot
  const categoryCard = document.createElement('div');
  categoryCard.className = 'cloud-card';
  categoryCard.style.marginBottom = '1.75rem';

  const catSpendings = store.getCategorySpending().slice(0, 4);

  categoryCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
        <span>🗂️</span> Category Spending
      </h3>
      <button class="pill squish-btn" id="view-all-cats-btn" style="cursor: pointer; border: none;">View All &rarr;</button>
    </div>
    <div class="cat-list-box" style="display: flex; flex-direction: column; gap: 1rem;">
      ${
        catSpendings.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 1rem;">No category expenses yet this month! 🌸</p>'
          : catSpendings
              .map(c => `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; font-weight: 700; margin-bottom: 0.35rem;">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                <span>${c.emoji}</span> ${c.name}
              </span>
              <span>${formatCurrency(c.spent, curr)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">/ ${c.monthly_limit > 0 ? formatCurrency(c.monthly_limit, curr) : 'No cap'}</span></span>
            </div>
            <div class="cloud-progress" style="height: 10px;">
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
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          <span>🔁</span> Recurring Bills & Subs
        </h3>
        <button class="pill squish-btn" id="view-all-bills-btn" style="cursor: pointer; border: none;">Manage &rarr;</button>
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
        <span>📝</span> Recent Cloud Activity
      </h3>
      <button class="pill squish-btn" id="view-all-tx-btn" style="cursor: pointer; border: none;">View All &rarr;</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.65rem;">
      ${
        recentTx.length === 0
          ? '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 1.5rem;">No transactions yet! Tap "+" to log your first treat. ☁️</p>'
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

// ====================================================================
// CLOUDY BUDGET - INSIGHTS & ANALYTICS VIEW
// Interactive pastel charts powered by Chart.js
// ====================================================================

import { store } from '../lib/store.js';
import { formatCurrency, getCurrentMonthKey, formatMonthName } from '../lib/format.js';
import Chart from 'chart.js/auto';

let donutChartInstance = null;
let trendChartInstance = null;

export function renderInsights() {
  const container = document.createElement('div');
  container.className = 'insights-view anim-fade-in';

  let selectedMonth = getCurrentMonthKey();

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const curr = settings.currency;
    const catSpendings = store.getCategorySpending(selectedMonth);
    const summary = store.getMonthSummary(selectedMonth);

    // Destroy existing charts to prevent memory leak
    if (donutChartInstance) {
      donutChartInstance.destroy();
      donutChartInstance = null;
    }
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;';
    header.innerHTML = `
      <div>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem;">
          <span>📊</span> Financial Cloud Insights
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
          Visualize where your income flows each month
        </p>
      </div>
      <div>
        <input type="month" id="insights-month-input" class="form-input" value="${selectedMonth}" style="padding: 0.5rem 0.85rem; font-weight: 700;">
      </div>
    `;

    header.querySelector('#insights-month-input').onchange = (e) => {
      selectedMonth = e.target.value;
      renderContent();
    };
    container.appendChild(header);

    // Top KPI cards
    const highestCat = catSpendings.length > 0 && catSpendings[0].spent > 0 ? catSpendings[0] : null;
    const daysInMonth = 30;
    const dailyAvg = summary.totalExpense / (new Date().getDate() || 1);

    const kpiRow = document.createElement('div');
    kpiRow.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;';
    kpiRow.innerHTML = `
      <div class="cloud-card" style="padding: 1.15rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Top Category</span>
        <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
          ${highestCat ? `<span>${highestCat.emoji}</span> ${highestCat.name}` : 'None yet'}
        </div>
        <div style="font-size: 0.82rem; color: var(--coral-alert); font-weight: 700;">
          ${highestCat ? formatCurrency(highestCat.spent, curr) : '₱0'}
        </div>
      </div>

      <div class="cloud-card" style="padding: 1.15rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Daily Avg Spend</span>
        <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; margin-top: 0.25rem;">
          ${formatCurrency(dailyAvg, curr)}
        </div>
        <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">per day this month</div>
      </div>

      <div class="cloud-card" style="padding: 1.15rem;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Net Savings</span>
        <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; margin-top: 0.25rem; color: ${
          summary.balance >= 0 ? 'var(--mint-deep)' : 'var(--coral-alert)'
        };">
          ${formatCurrency(summary.balance, curr)}
        </div>
        <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">Income minus expenses</div>
      </div>
    `;
    container.appendChild(kpiRow);

    // Charts Grid
    const chartsGrid = document.createElement('div');
    chartsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;';

    // Chart 1: Donut breakdown
    const donutBox = document.createElement('div');
    donutBox.className = 'cloud-card';
    donutBox.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem;">
        <span>🍩</span> Category Breakdown
      </h3>
      <div style="position: relative; height: 260px;">
        <canvas id="category-donut-chart"></canvas>
      </div>
    `;
    chartsGrid.appendChild(donutBox);

    // Chart 2: Daily Spending Trend
    const trendBox = document.createElement('div');
    trendBox.className = 'cloud-card';
    trendBox.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem;">
        <span>📈</span> Spending Over Time
      </h3>
      <div style="position: relative; height: 260px;">
        <canvas id="daily-trend-chart"></canvas>
      </div>
    `;
    chartsGrid.appendChild(trendBox);

    container.appendChild(chartsGrid);

    // Initialize Chart.js after DOM attached
    setTimeout(() => {
      initCharts(catSpendings, selectedMonth);
    }, 50);
  }

  function initCharts(catSpendings, monthKey) {
    const activeCats = catSpendings.filter(c => c.spent > 0);
    const donutCanvas = container.querySelector('#category-donut-chart');
    const trendCanvas = container.querySelector('#daily-trend-chart');

    const pastelColors = [
      '#FFB7D2', '#7EC1F1', '#9CE3C0', '#FFE58F', 
      '#DDD6FE', '#FFD29D', '#A5B4FC', '#FCA5A5'
    ];

    if (donutCanvas) {
      const labels = activeCats.length > 0 ? activeCats.map(c => `${c.emoji} ${c.name}`) : ['No data'];
      const data = activeCats.length > 0 ? activeCats.map(c => c.spent) : [1];
      const colors = activeCats.length > 0 ? pastelColors.slice(0, activeCats.length) : ['#E2E8F0'];

      donutChartInstance = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Nunito', weight: 'bold', size: 11 },
                padding: 12,
              },
            },
          },
          cutout: '68%',
        },
      });
    }

    if (trendCanvas) {
      // Group daily transactions for the month
      const allTx = store.getTransactions().filter(t => t.type === 'expense' && t.date && t.date.startsWith(monthKey));
      const daysMap = {};

      allTx.forEach(t => {
        const day = t.date.slice(8); // '01', '02', etc.
        daysMap[day] = (daysMap[day] || 0) + t.amount;
      });

      const sortedDays = Object.keys(daysMap).sort();
      const labels = sortedDays.map(d => `Day ${parseInt(d)}`);
      const data = sortedDays.map(d => daysMap[d]);

      trendChartInstance = new Chart(trendCanvas, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['No expenses'],
          datasets: [{
            label: 'Daily Spent',
            data: data.length > 0 ? data : [0],
            backgroundColor: 'rgba(126, 193, 241, 0.75)',
            borderColor: '#55A8E8',
            borderWidth: 2,
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(200, 220, 240, 0.25)' },
              ticks: { font: { family: 'Nunito', weight: 'bold' } },
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Nunito', weight: 'bold' } },
            },
          },
        },
      });
    }
  }

  renderContent();
  return container;
}

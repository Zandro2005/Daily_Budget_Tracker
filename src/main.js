// ====================================================================
// CLOUDY BUDGET - MAIN APPLICATION ENTRY POINT & ROUTER
// ====================================================================

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/animations.css';

import { store } from './lib/store.js';
import { playPop, playPuppyChirp } from './lib/audio.js';
import { openQuickAddModal } from './components/quickAddModal.js';
import { ICONS } from './lib/icons.js';
import { getSyncStatus, onSyncStatusChange } from './lib/firebase.js';

// Views
import { renderDashboard } from './views/dashboard.js';
import { renderPlanner } from './views/planner.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderRecurring } from './views/recurring.js';
import { renderGoals } from './views/goals.js';
import { renderInsights } from './views/insights.js';
import { renderCalendar } from './views/calendar.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  '': renderDashboard,
  '#dashboard': renderDashboard,
  '#planner': renderPlanner,
  '#transactions': renderTransactions,
  '#calendar': renderCalendar,
  '#categories': renderCategories,
  '#bills': renderRecurring,
  '#goals': renderGoals,
  '#insights': renderInsights,
  '#settings': renderSettings,
};

function getSyncBadgeHtml(status) {
  if (status === 'synced') {
    return `<span class="pill" style="background: rgba(86, 193, 144, 0.15); color: var(--mint-deep); font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.55rem; display: flex; align-items: center; gap: 0.3rem;" title="Live Cloud Sync Active"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--mint-deep);"></span>Synced</span>`;
  }
  if (status === 'syncing') {
    return `<span class="pill" style="background: rgba(255, 210, 157, 0.25); color: #C67A10; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.55rem; display: flex; align-items: center; gap: 0.3rem;" title="Syncing with Firebase..."><span style="width: 7px; height: 7px; border-radius: 50%; background: #C67A10;"></span>Syncing</span>`;
  }
  if (status === 'error') {
    return `<span class="pill" style="background: rgba(255, 123, 137, 0.2); color: var(--danger); font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.55rem; display: flex; align-items: center; gap: 0.3rem;" title="Cloud Sync Warning"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--danger);"></span>Sync alert</span>`;
  }
  return `<span class="pill" style="background: var(--sky-100); color: var(--text-muted); font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.55rem; display: flex; align-items: center; gap: 0.3rem;" title="Local Storage Mode"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted);"></span>Local</span>`;
}

function initApp() {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  // Build Shell Structure
  appRoot.innerHTML = `
    <!-- Sky ambient clouds and subtle decor -->
    <div class="sky-decor">
      <div class="decor-cloud decor-cloud-1"></div>
      <div class="decor-cloud decor-cloud-2"></div>
      <div class="decor-cloud decor-cloud-3"></div>
    </div>

    <!-- Main Container -->
    <div class="app-container">
      <!-- App Header -->
      <header class="app-header">
        <a href="#dashboard" class="brand" id="brand-link">
          <img src="/assets/mascot/happy.jpg" class="brand-avatar" alt="Lyka Wallet Mascot">
          <div class="brand-title">Lyka Wallet</div>
        </a>

        <div class="header-controls">
          <a href="#settings" id="header-sync-badge" style="text-decoration: none; cursor: pointer;">
            ${getSyncBadgeHtml(getSyncStatus())}
          </a>
          <button class="icon-btn squish-btn" id="theme-toggle-btn" title="Toggle Day/Night" style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
            ${store.getSettings().theme === 'night' ? ICONS.moon : ICONS.sun}
          </button>
          <a href="#settings" class="icon-btn squish-btn" title="Settings" style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
            ${ICONS.settings}
          </a>
        </div>
      </header>

      <!-- View Slot -->
      <main id="main-view-slot"></main>

      <!-- Bottom Floating Nav Bar (Simple & Professional Mobile UI) -->
      <nav class="nav-bar">
        <button class="nav-link" data-route="#dashboard" title="Home">
          ${ICONS.home}
          <span>Home</span>
        </button>
        <button class="nav-link" data-route="#planner" title="Planner">
          ${ICONS.calendar}
          <span>Planner</span>
        </button>

        <!-- Center Quick Add Action Button -->
        <button class="fab-add squish-btn" id="nav-quick-add" title="Quick Add">
          +
        </button>

        <button class="nav-link" data-route="#calendar" title="Daily Tracker">
          ${ICONS.calendarDays}
          <span>Daily</span>
        </button>
        <button class="nav-link" data-route="#transactions" title="History">
          ${ICONS.history}
          <span>History</span>
        </button>
      </nav>
    </div>
  `;

  // Attach Header Events
  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn.addEventListener('click', () => {
    playPop();
    const newTheme = store.toggleTheme();
    themeBtn.innerHTML = newTheme === 'night' ? ICONS.moon : ICONS.sun;
  });

  const syncBadgeEl = document.getElementById('header-sync-badge');
  onSyncStatusChange((newStatus) => {
    if (syncBadgeEl) {
      syncBadgeEl.innerHTML = getSyncBadgeHtml(newStatus);
    }
  });

  const quickAddBtn = document.getElementById('nav-quick-add');
  if (quickAddBtn) {
    quickAddBtn.onclick = (e) => {
      e.preventDefault();
      playPop();
      openQuickAddModal('expense');
    };
  }

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      playPop();
      const route = link.dataset.route;
      window.location.hash = route;
    });
  });

  // Mascot pet sound on brand avatar click
  document.getElementById('brand-link').addEventListener('click', () => {
    playPuppyChirp();
  });

  // Handle Route Changes
  function handleRoute(isNavigation = false) {
    const hash = window.location.hash || '#dashboard';
    const renderFn = ROUTES[hash] || renderDashboard;

    // Update active nav link
    navLinks.forEach(link => {
      if (link.dataset.route === hash || (hash === '' && link.dataset.route === '#dashboard')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const slot = document.getElementById('main-view-slot');
    if (slot) {
      const prevScrollY = window.scrollY;
      slot.innerHTML = '';
      slot.appendChild(renderFn());
      if (isNavigation) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo(0, prevScrollY);
      }
    }
  }

  window.addEventListener('hashchange', () => handleRoute(true));
  handleRoute(true);

  // Batch re-rendering on store updates with RAF to preserve smoothness
  let renderRaf = null;
  store.subscribe(() => {
    if (renderRaf) cancelAnimationFrame(renderRaf);
    renderRaf = requestAnimationFrame(() => {
      handleRoute(false);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.protocol.startsWith('https'))) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update().catch(() => {});
      }).catch((err) => {
        console.warn('PWA service worker registration note:', err);
      });
    });
  }
});

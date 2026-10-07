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

// Views
import { renderDashboard } from './views/dashboard.js';
import { renderPlanner } from './views/planner.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderRecurring } from './views/recurring.js';
import { renderGoals } from './views/goals.js';
import { renderInsights } from './views/insights.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  '': renderDashboard,
  '#dashboard': renderDashboard,
  '#planner': renderPlanner,
  '#transactions': renderTransactions,
  '#categories': renderCategories,
  '#bills': renderRecurring,
  '#goals': renderGoals,
  '#insights': renderInsights,
  '#settings': renderSettings,
};

function initApp() {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  // Build Shell Structure
  appRoot.innerHTML = `
    <!-- Sky ambient clouds and stars -->
    <div class="sky-decor">
      <div class="decor-cloud decor-cloud-1"></div>
      <div class="decor-cloud decor-cloud-2"></div>
      <div class="decor-cloud decor-cloud-3"></div>
      <div class="decor-star" style="top: 15%; left: 20%;">✨</div>
      <div class="decor-star" style="top: 25%; right: 25%;">⭐</div>
      <div class="decor-star" style="top: 45%; left: 8%;">✨</div>
      <div class="decor-star" style="top: 70%; right: 15%;">🌟</div>
    </div>

    <!-- Main Container -->
    <div class="app-container">
      <!-- App Header -->
      <header class="app-header">
        <a href="#dashboard" class="brand" id="brand-link">
          <img src="/assets/mascot/happy.jpg" class="brand-avatar" alt="Lyka Wallet Mascot">
          <div class="brand-title">Lyka Wallet <span style="font-size: 1rem;">☁️</span></div>
        </a>

        <div class="header-controls">
          <button class="icon-btn squish-btn" id="theme-toggle-btn" title="Toggle Day/Night Sky">
            ${store.getSettings().theme === 'night' ? '🌙' : '☀️'}
          </button>
          <a href="#settings" class="icon-btn squish-btn" title="Settings">
            ⚙️
          </a>
        </div>
      </header>

      <!-- View Slot -->
      <main id="main-view-slot"></main>

      <!-- Bottom Floating Nav Bar (Simple & Professional Mobile UI) -->
      <nav class="nav-bar">
        <button class="nav-link" data-route="#dashboard" title="Home">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </button>
        <button class="nav-link" data-route="#planner" title="Planner">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Planner</span>
        </button>

        <!-- Center Quick Add Action Button -->
        <button class="fab-add squish-btn" id="nav-quick-add" title="Quick Add">
          +
        </button>

        <button class="nav-link" data-route="#transactions" title="History">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>History</span>
        </button>
        <button class="nav-link" data-route="#settings" title="Settings">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  `;

  // Attach Header Events
  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn.addEventListener('click', () => {
    playPop();
    const newTheme = store.toggleTheme();
    themeBtn.textContent = newTheme === 'night' ? '🌙' : '☀️';
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
  function handleRoute() {
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
      slot.innerHTML = '';
      slot.appendChild(renderFn());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Re-render current view when store updates
  store.subscribe(() => {
    handleRoute();
  });
}

document.addEventListener('DOMContentLoaded', initApp);

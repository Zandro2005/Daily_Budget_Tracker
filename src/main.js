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
import { isSupabaseConfigured } from './lib/supabase.js';

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
          <img src="/assets/mascot/happy.jpg" class="brand-avatar" alt="Cloudy Mascot">
          <div>
            <div class="brand-title">Cloudy Budget <span style="font-size: 1.1rem;">☁️</span></div>
            <div class="brand-tagline">Joyful & Mindful Finances</div>
          </div>
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
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>
        <button class="nav-link" data-route="#planner" title="Planner">
          <span class="nav-icon">🗓️</span>
          <span>Planner</span>
        </button>

        <!-- Center Quick Add Action Button -->
        <button class="fab-add squish-btn" id="nav-quick-add" title="Quick Add">
          +
        </button>

        <button class="nav-link" data-route="#transactions" title="History">
          <span class="nav-icon">📋</span>
          <span>History</span>
        </button>
        <button class="nav-link" data-route="#settings" title="Settings">
          <span class="nav-icon">⚙️</span>
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
  quickAddBtn.addEventListener('click', () => {
    playPop();
    openQuickAddModal('expense');
  });

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

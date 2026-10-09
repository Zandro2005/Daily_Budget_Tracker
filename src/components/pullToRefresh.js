// ====================================================================
// LYKA WALLET - PULL TO REFRESH & QUICK APP RELOAD
// Native-app experience for iOS & Android standalone home screen web app
// ====================================================================

import { ICONS } from '../lib/icons.js';
import { playPop } from '../lib/audio.js';

let isRefreshing = false;

export function triggerAppRefresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    playPop();
  } catch (_) {}

  // Spin any refresh icon on page
  const refreshBtns = document.querySelectorAll('.refresh-btn-icon, .ptr-icon');
  refreshBtns.forEach(btn => btn.classList.add('spinning'));

  // Give a fast visual feedback, then perform full PWA page reload
  setTimeout(() => {
    window.location.reload();
  }, 350);
}

export function initPullToRefresh() {
  // Check if pull container already exists
  if (document.getElementById('ptr-container')) return;

  const ptrContainer = document.createElement('div');
  ptrContainer.id = 'ptr-container';
  ptrContainer.className = 'ptr-container';
  ptrContainer.innerHTML = `
    <div class="ptr-pill" id="ptr-pill">
      <span class="ptr-icon" id="ptr-icon">
        ${ICONS.refresh}
      </span>
      <span id="ptr-text">Pull to refresh...</span>
    </div>
  `;
  document.body.prepend(ptrContainer);

  const ptrPill = ptrContainer.querySelector('#ptr-pill');
  const ptrIcon = ptrContainer.querySelector('#ptr-icon');
  const ptrText = ptrContainer.querySelector('#ptr-text');

  let startY = 0;
  let startX = 0;
  let isTracking = false;
  let pullDistance = 0;
  const PULL_THRESHOLD = 65;

  window.addEventListener(
    'touchstart',
    e => {
      if (isRefreshing) return;
      // Only track if page is at the very top
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop <= 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        isTracking = true;
        pullDistance = 0;
      } else {
        isTracking = false;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    e => {
      if (!isTracking || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startY;
      const deltaX = currentX - startX;

      // Ensure page is still at top and pull is vertical
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop > 0 || deltaY <= 0 || Math.abs(deltaX) > deltaY) {
        if (pullDistance > 0) {
          ptrContainer.style.height = '0px';
          ptrContainer.classList.remove('ptr-active');
        }
        return;
      }

      // Elastic resistance
      pullDistance = Math.min(85, deltaY * 0.42);

      if (pullDistance > 10) {
        ptrContainer.style.height = `${pullDistance + 12}px`;
        ptrContainer.classList.add('ptr-active');

        const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
        ptrIcon.style.transform = `rotate(${progress * 180}deg)`;

        if (pullDistance >= PULL_THRESHOLD) {
          ptrText.textContent = 'Release to refresh ✨';
        } else {
          ptrText.textContent = 'Pull down to refresh...';
        }
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchend',
    () => {
      if (!isTracking || isRefreshing) return;
      isTracking = false;

      if (pullDistance >= PULL_THRESHOLD) {
        ptrText.textContent = 'Refreshing...';
        ptrIcon.classList.add('spinning');
        triggerAppRefresh();
      } else {
        ptrContainer.style.height = '0px';
        ptrContainer.classList.remove('ptr-active');
        setTimeout(() => {
          ptrIcon.style.transform = 'rotate(0deg)';
        }, 200);
      }
      pullDistance = 0;
    },
    { passive: true }
  );
}

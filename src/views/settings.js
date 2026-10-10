// ====================================================================
// CLOUDY BUDGET - SETTINGS & SYNC VIEW
// Preferences, Firebase Cloud configuration, and Backup/Restore
// ====================================================================

import { store } from '../lib/store.js';
import { playPop, playCoin, isSoundEnabled, setSoundEnabled } from '../lib/audio.js';
import { isFirebaseConfigured, getSyncStatus, onSyncStatusChange, getSyncBadgeHtml } from '../lib/firebase.js';
import { showToast } from '../components/toast.js';
import { ICONS } from '../lib/icons.js';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const isCloudConnected = isFirebaseConfigured();

    // Header
    const header = document.createElement('div');
    header.style.marginBottom = '1.5rem';
    header.innerHTML = `
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
        ${ICONS.settings} Preferences & Cloud Sync
      </h2>
      <p style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin: 0.2rem 0 0 0;">
        Personalize your wallet, manage realtime Firebase sync, and backup data
      </p>
    `;
    container.appendChild(header);

    // 1. General Preferences Card
    const prefCard = document.createElement('div');
    prefCard.className = 'cloud-card';
    prefCard.style.marginBottom = '1.5rem';
    prefCard.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.4rem; margin: 0 0 1.25rem 0;">
        ${ICONS.settings} App Preferences
      </h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem;">
        <!-- Currency -->
        <div class="form-group">
          <label class="form-label">Currency Symbol</label>
          <select id="setting-currency" class="form-select">
            <option value="₱" ${settings.currency === '₱' ? 'selected' : ''}>₱ - Philippine Peso (PHP)</option>
            <option value="$" ${settings.currency === '$' ? 'selected' : ''}>$ - US Dollar (USD)</option>
            <option value="€" ${settings.currency === '€' ? 'selected' : ''}>€ - Euro (EUR)</option>
            <option value="£" ${settings.currency === '£' ? 'selected' : ''}>£ - British Pound (GBP)</option>
            <option value="¥" ${settings.currency === '¥' ? 'selected' : ''}>¥ - Japanese Yen (JPY)</option>
            <option value="₩" ${settings.currency === '₩' ? 'selected' : ''}>₩ - Korean Won (KRW)</option>
            <option value="S$" ${settings.currency === 'S$' ? 'selected' : ''}>S$ - Singapore Dollar (SGD)</option>
          </select>
        </div>

        <!-- Monthly Target Budget -->
        <div class="form-group">
          <label class="form-label">Monthly Target Budget Cap</label>
          <input type="number" id="setting-budget" class="form-input" value="${settings.monthlyBudget || 0}" placeholder="0">
        </div>

        <!-- Theme Mode -->
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select id="setting-theme" class="form-select">
            <option value="day" ${settings.theme === 'day' ? 'selected' : ''}>Day Mode (Clean Sky Blue & White)</option>
            <option value="night" ${settings.theme === 'night' ? 'selected' : ''}>Night Mode (Twilight Slate)</option>
          </select>
        </div>

        <!-- Pay Schedule -->
        <div class="form-group">
          <label class="form-label">Payday Schedule</label>
          <select id="setting-paycycle" class="form-select">
            <option value="semi-monthly" ${(settings.payCycle || 'semi-monthly') === 'semi-monthly' ? 'selected' : ''}>Twice a Month (10th & 25th)</option>
            <option value="monthly" ${settings.payCycle === 'monthly' ? 'selected' : ''}>Monthly Payday</option>
          </select>
        </div>

        <!-- Savings Target % -->
        <div class="form-group">
          <label class="form-label">Savings Target (% of each paycheck)</label>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="number" id="setting-savings-pct" class="form-input" min="0" max="90" step="1" value="${Math.round(store.getSavingsRate() * 100)}">
            <span style="font-weight: 800; font-size: 1.15rem; color: var(--coral-alert);">%</span>
          </div>
        </div>

        <!-- 10th Salary -->
        <div class="form-group">
          <label class="form-label">Expected Salary on 10th (${settings.currency || '₱'})</label>
          <input type="number" id="setting-sal-10" class="form-input" value="${(settings.salaryByPayday && settings.salaryByPayday[10] !== undefined) ? settings.salaryByPayday[10] : 0}" placeholder="0">
        </div>

        <!-- 25th Salary -->
        <div class="form-group">
          <label class="form-label">Expected Salary on 25th (${settings.currency || '₱'})</label>
          <input type="number" id="setting-sal-25" class="form-input" value="${(settings.salaryByPayday && settings.salaryByPayday[25] !== undefined) ? settings.salaryByPayday[25] : 0}" placeholder="0">
        </div>

        <!-- Sound Effects -->
        <div class="form-group">
          <label class="form-label">Audio Effects</label>
          <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; padding-top: 0.35rem;">
            <input type="checkbox" id="setting-sound" ${isSoundEnabled() ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--sky-500);">
            <span style="font-weight: 700; font-size: 0.95rem;">Enable gentle interaction chimes</span>
          </label>
        </div>
      </div>

      <button class="btn btn-primary squish-btn" id="save-pref-btn" style="margin-top: 1rem;">
        Save Preferences
      </button>
    `;

    prefCard.querySelector('#save-pref-btn').onclick = () => {
      const currency = prefCard.querySelector('#setting-currency').value;
      const theme = prefCard.querySelector('#setting-theme').value;
      const payCycle = prefCard.querySelector('#setting-paycycle').value;
      const sal10 = parseFloat(prefCard.querySelector('#setting-sal-10').value) || 0;
      const sal25 = parseFloat(prefCard.querySelector('#setting-sal-25').value) || 0;
      const savingsPct = parseFloat(prefCard.querySelector('#setting-savings-pct').value) || 28;
      const savingsRate = Math.max(0, Math.min(0.9, savingsPct / 100));
      const totalExpected = sal10 + sal25;
      const monthlyBudget = parseFloat(prefCard.querySelector('#setting-budget').value) || Math.round(totalExpected * (1 - savingsRate));
      const sound = prefCard.querySelector('#setting-sound').checked;

      setSoundEnabled(sound);
      store.updateSettings({
        currency,
        monthlyBudget,
        theme,
        payCycle,
        salaryByPayday: { 10: sal10, 25: sal25 },
        expectedIncome: totalExpected,
        savingsRate,
        soundEnabled: sound,
      });
      playCoin();
      showToast({ text: 'Preferences updated successfully', icon: 'check' });
    };

    container.appendChild(prefCard);

    // 2. Firebase Database Sync Card (Credentials protected and hidden)
    const dbCard = document.createElement('div');
    dbCard.className = 'cloud-card';
    dbCard.style.marginBottom = '1.5rem';
    dbCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          ${ICONS.repeat} Firebase Realtime Cloud Sync
        </h3>
        <div id="settings-sync-badge">
          ${getSyncBadgeHtml(getSyncStatus())}
        </div>
      </div>

      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.15rem;">
        Your budget syncs in real-time across your phone, tablet, and computer with zero login required. Private keys and cloud credentials are kept securely in backend configuration and never exposed on-screen.
      </p>

      ${isCloudConnected ? `
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-primary squish-btn" id="fb-sync-now-btn">
            ${ICONS.repeat} Sync Now
          </button>
        </div>
        <div id="fb-status-box" style="margin-top: 0.85rem; font-size: 0.85rem; font-weight: 700;"></div>
      ` : `
        <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">
          Running in offline browser storage.
        </div>
      `}
    `;

    const syncBadgeEl = dbCard.querySelector('#settings-sync-badge');
    onSyncStatusChange((newStatus) => {
      if (syncBadgeEl) syncBadgeEl.innerHTML = getSyncBadgeHtml(newStatus);
    });

    if (dbCard.querySelector('#fb-sync-now-btn')) {
      dbCard.querySelector('#fb-sync-now-btn').onclick = async () => {
        playPop();
        const statusBox = dbCard.querySelector('#fb-status-box');
        if (statusBox) statusBox.innerHTML = '<span>Syncing local data to Firebase cloud...</span>';
        try {
          await store.pushLocalDataToCloud();
          playCoin();
          if (statusBox) statusBox.innerHTML = '<span style="color: var(--mint-deep);">All local budget data synced to Cloud!</span>';
          showToast({ text: 'Cloud sync complete', icon: 'check' });
        } catch (err) {
          if (statusBox) statusBox.innerHTML = `<span style="color: var(--danger);">Sync error: ${err.message}</span>`;
        }
      };
    }

    container.appendChild(dbCard);

    // 3. Safe Backup & Restore (Destructive Wipe Removed)
    const backupCard = document.createElement('div');
    backupCard.className = 'cloud-card';
    backupCard.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem; margin: 0 0 0.85rem 0;">
        ${ICONS.folder} Data Backup & Restore
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
        Safely download and preserve copies of your budget and transactions anytime.
      </p>

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-secondary squish-btn" id="backup-json-btn">
          Download JSON Backup
        </button>
        <button class="btn btn-secondary squish-btn" id="backup-csv-btn">
          Export CSV Sheet
        </button>
        <label class="btn btn-secondary squish-btn" style="cursor: pointer; margin: 0;">
          Import JSON
          <input type="file" id="import-json-input" accept=".json" style="display: none;">
        </label>
      </div>
    `;

    backupCard.querySelector('#backup-json-btn').onclick = () => {
      playPop();
      store.exportJSON();
      showToast({ text: 'JSON Backup created', icon: 'check' });
    };

    backupCard.querySelector('#backup-csv-btn').onclick = () => {
      playPop();
      store.exportCSV();
      showToast({ text: 'CSV downloaded', icon: 'check' });
    };

    backupCard.querySelector('#import-json-input').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = store.importJSON(event.target.result);
        if (result && result.success) {
          playCoin();
          showToast({ text: `Data restored! (${result.count} transactions)`, icon: 'check' });
          renderContent();
        } else {
          showToast({ text: `Import failed: ${result?.error || 'Invalid file format'}` });
        }
      };
      reader.readAsText(file);
    };

    container.appendChild(backupCard);

    // 4. Fresh Start / Delete All Data
    const dangerCard = document.createElement('div');
    dangerCard.className = 'cloud-card';
    dangerCard.style.marginTop = '1.5rem';
    dangerCard.style.border = '1.5px solid var(--coral-alert)';
    dangerCard.style.background = 'linear-gradient(135deg, rgba(255, 235, 237, 0.4) 0%, rgba(255, 255, 255, 0.95) 100%)';
    dangerCard.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: #B91C1C; margin: 0 0 0.65rem 0; display: flex; align-items: center; gap: 0.45rem;">
        <span style="display: flex; width: 18px; height: 18px;">${ICONS.trash}</span>
        Fresh Start (Delete All Data)
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.15rem; line-height: 1.5;">
        Permanently delete all envelopes, transactions, cutoff records, hiram loans, and Firebase cloud collections to start with a completely fresh slate.
      </p>
      <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
        <button class="btn squish-btn" id="fresh-start-btn" style="background: var(--coral-alert); color: white; border: none; font-weight: 700; padding: 0.65rem 1.25rem; border-radius: var(--radius-full); cursor: pointer;">
          Delete All Data & Start Fresh
        </button>
        <button class="btn btn-secondary squish-btn" id="restore-default-cats-btn" style="font-weight: 700; padding: 0.65rem 1.15rem; border-radius: var(--radius-full); cursor: pointer; font-size: 0.82rem;">
          Load Default 4 Envelopes
        </button>
      </div>
    `;

    const freshBtn = dangerCard.querySelector('#fresh-start-btn');
    freshBtn.onclick = async () => {
      playPop();
      if (confirm('Are you sure you want to delete ALL data and start fresh? This will permanently wipe all envelopes, transactions, cutoffs, and Firebase cloud collections so no junk is left.')) {
        try {
          freshBtn.disabled = true;
          freshBtn.textContent = 'Wiping Firebase & local data...';
          await store.clearAllData();
          playCoin();
          showToast({ text: 'All data & envelopes wiped from Firebase and device! 🌟', icon: 'check' });
          setTimeout(() => {
            window.location.href = '#dashboard';
            window.location.reload();
          }, 400);
        } catch (err) {
          showToast({ text: 'Error clearing data: ' + err.message });
          freshBtn.disabled = false;
          freshBtn.textContent = 'Delete All Data & Start Fresh';
        }
      }
    };

    const restoreBtn = dangerCard.querySelector('#restore-default-cats-btn');
    if (restoreBtn) {
      restoreBtn.onclick = async () => {
        playPop();
        if (confirm('Load the 4 standard envelopes (Bills, Shopping & Needs, Cutoff Allowance, Miscellaneous)?')) {
          try {
            restoreBtn.disabled = true;
            await store.resetToStandardEnvelopes();
            playCoin();
            showToast({ text: 'Default 4 envelopes loaded! 📁', icon: 'check' });
            renderContent();
          } catch (err) {
            showToast({ text: 'Error: ' + err.message });
          } finally {
            restoreBtn.disabled = false;
          }
        }
      };
    }

    container.appendChild(dangerCard);
  }

  renderContent();
  return container;
}

// ====================================================================
// CLOUDY BUDGET - SETTINGS & SYNC VIEW
// Preferences, Firebase Cloud configuration, and Backup/Restore
// ====================================================================

import { store } from '../lib/store.js';
import { playPop, playCoin, isSoundEnabled, setSoundEnabled } from '../lib/audio.js';
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  isFirebaseConfigured
} from '../lib/firebase.js';
import { showToast } from '../components/toast.js';
import { ICONS } from '../lib/icons.js';

export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'settings-view anim-fade-in';

  function renderContent() {
    container.innerHTML = '';
    const settings = store.getSettings();
    const fbConfig = getFirebaseConfig();
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

    // 2. Firebase Database Sync Card
    const dbCard = document.createElement('div');
    dbCard.className = 'cloud-card';
    dbCard.style.marginBottom = '1.5rem';
    dbCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
          ${ICONS.repeat} Firebase Realtime Cloud Sync
        </h3>
        <span class="pill" style="background: ${isCloudConnected ? 'var(--mint-green)' : 'var(--sky-100)'}; color: var(--navy-800); font-weight: 700;">
          ${isCloudConnected ? 'Realtime Cloud Sync Active' : 'Offline Local Mode (Ready)'}
        </span>
      </div>

      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">
        Your budget syncs seamlessly across your phone, laptop, and tablet with <strong>zero login required</strong>!
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label class="form-label">Project ID</label>
          <input type="text" id="fb-project-id" class="form-input" placeholder="lyka-budget-tracker" value="${fbConfig ? (fbConfig.projectId || '') : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">API Key</label>
          <input type="password" id="fb-api-key" class="form-input" placeholder="AIzaSy..." value="${fbConfig ? (fbConfig.apiKey || '') : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">App ID</label>
          <input type="text" id="fb-app-id" class="form-input" placeholder="1:123456789:web:abcdef" value="${fbConfig ? (fbConfig.appId || '') : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Auth Domain (optional)</label>
          <input type="text" id="fb-auth-domain" class="form-input" placeholder="project-id.firebaseapp.com" value="${fbConfig ? (fbConfig.authDomain || '') : ''}">
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
        <button class="btn btn-primary squish-btn" id="fb-save-btn">
          Connect Firebase
        </button>
        ${isCloudConnected ? `
          <button class="btn btn-secondary squish-btn" id="fb-sync-now-btn">
            Sync Local Data to Cloud
          </button>
          <button class="btn btn-danger squish-btn" id="fb-disconnect-btn">
            Disconnect
          </button>
        ` : ''}
      </div>

      <div id="fb-status-box" style="margin-top: 1rem; font-size: 0.85rem; font-weight: 700;"></div>
    `;

    dbCard.querySelector('#fb-save-btn').onclick = () => {
      playPop();
      const projectId = dbCard.querySelector('#fb-project-id').value.trim();
      const apiKey = dbCard.querySelector('#fb-api-key').value.trim();
      const appId = dbCard.querySelector('#fb-app-id').value.trim();
      const authDomain = dbCard.querySelector('#fb-auth-domain').value.trim() || `${projectId}.firebaseapp.com`;
      const statusBox = dbCard.querySelector('#fb-status-box');

      if (!projectId || !apiKey) {
        statusBox.innerHTML = '<span style="color: var(--danger);">Please enter both Project ID and API Key!</span>';
        return;
      }

      const config = {
        projectId,
        apiKey,
        appId,
        authDomain,
        storageBucket: `${projectId}.appspot.com`,
      };

      saveFirebaseConfig(config);
      store.initFirebase();
      playCoin();
      showToast({ text: 'Firebase connected! Live sync active.', icon: 'check' });
      renderContent();
    };

    if (dbCard.querySelector('#fb-sync-now-btn')) {
      dbCard.querySelector('#fb-sync-now-btn').onclick = async () => {
        playPop();
        const statusBox = dbCard.querySelector('#fb-status-box');
        statusBox.innerHTML = '<span>Syncing local data to Firebase cloud...</span>';
        try {
          await store.pushLocalDataToCloud();
          playCoin();
          statusBox.innerHTML = '<span style="color: var(--mint-deep);">All local budget data synced to Cloud!</span>';
          showToast({ text: 'Cloud sync complete', icon: 'check' });
        } catch (err) {
          statusBox.innerHTML = `<span style="color: var(--danger);">Sync error: ${err.message}</span>`;
        }
      };
    }

    if (dbCard.querySelector('#fb-disconnect-btn')) {
      dbCard.querySelector('#fb-disconnect-btn').onclick = () => {
        if (confirm('Disconnect from Firebase and use local browser storage only?')) {
          saveFirebaseConfig(null);
          location.reload();
        }
      };
    }

    container.appendChild(dbCard);

    // 3. Backup, Restore & Reset
    const backupCard = document.createElement('div');
    backupCard.className = 'cloud-card';
    backupCard.innerHTML = `
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; margin: 0 0 1rem 0;">
        ${ICONS.folder} Data Backup & Restore
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
        Export your complete data anytime so you always keep your records.
      </p>

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button class="btn btn-secondary squish-btn" id="backup-json-btn">
          Download JSON Backup
        </button>
        <button class="btn btn-secondary squish-btn" id="backup-csv-btn">
          Export CSV Sheet
        </button>
        <label class="btn btn-secondary squish-btn" style="cursor: pointer;">
          Import JSON
          <input type="file" id="import-json-input" accept=".json" style="display: none;">
        </label>
        <button class="btn btn-secondary squish-btn" id="reset-demo-btn">
          Load Starter Data
        </button>
        <button class="btn btn-danger squish-btn" id="clear-all-btn" style="margin-left: auto;">
          Reset / Clear All Data
        </button>
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
        const success = store.importJSON(event.target.result);
        if (success) {
          playCoin();
          showToast({ text: 'Data restored successfully', icon: 'check' });
          renderContent();
        } else {
          showToast({ text: 'Failed to import JSON file' });
        }
      };
      reader.readAsText(file);
    };

    backupCard.querySelector('#reset-demo-btn').onclick = async () => {
      if (confirm('Reset to clean starter state? This will clear all transactions and reset data.')) {
        await store.clearAllData();
        playCoin();
        showToast({ text: 'All transactions cleared & reset', icon: 'check' });
        setTimeout(() => {
          window.location.hash = '#dashboard';
          window.location.reload();
        }, 500);
      }
    };

    backupCard.querySelector('#clear-all-btn').onclick = async () => {
      if (confirm('Reset everything? This will delete all transactions, cutoff records, recurring bills, and savings goals from both this device and Firebase cloud.')) {
        await store.clearAllData();
        playCoin();
        showToast({ text: 'All data permanently cleared' });
        setTimeout(() => {
          window.location.hash = '#dashboard';
          window.location.reload();
        }, 500);
      }
    };

    container.appendChild(backupCard);
  }

  renderContent();
  return container;
}

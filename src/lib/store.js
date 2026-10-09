// ====================================================================
// CLOUDY BUDGET - CENTRAL REACTIVE STORE
// Reliable local storage by default + Cloud Firestore Realtime Sync
// Designed for seamless multi-device live updates with zero-login
// ====================================================================

import {
  getTodayDateString,
  getCurrentMonthKey,
  getCutoffForDate,
  getPreviousCutoff,
  getNextCutoff,
  isDateInRange,
  formatShortRange,
  formatCurrency,
  parseDate,
  toDateString,
} from './format.js';
import { getDb, isFirebaseConfigured, setSyncStatus } from './firebase.js';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';

const STORAGE_KEYS = {
  CATEGORIES: 'cloudy_categories_v1',
  TRANSACTIONS: 'cloudy_transactions_v1',
  RECURRING: 'cloudy_recurring_v1',
  GOALS: 'cloudy_goals_v1',
  SETTINGS: 'cloudy_settings_v1',
  CUTOFFS: 'cloudy_cutoffs_v1',
  FIREBASE_INITIALIZED: 'cloudy_fb_seeded_v1',
};

const FS_COLLECTIONS = {
  CATEGORIES: 'cloudy_categories',
  TRANSACTIONS: 'cloudy_transactions',
  RECURRING: 'cloudy_recurring',
  GOALS: 'cloudy_goals',
  SETTINGS: 'cloudy_settings',
  CUTOFFS: 'cloudy_cutoffs',
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-bills', name: 'Bills', emoji: '', color: '#C8E6C9', monthly_limit: 0 },
  { id: 'cat-shopping', name: 'Shopping & Needs', emoji: '', color: '#E1BEE7', monthly_limit: 0 },
  { id: 'cat-daily', name: 'Cutoff Allowance', emoji: '', color: '#BFE3F7', monthly_limit: 0 },
  { id: 'cat-misc', name: 'Miscellaneous', emoji: '', color: '#FFE0B2', monthly_limit: 0 },
  { id: 'cat-income', name: 'Salary & Income', emoji: '', color: '#B2DFDB', monthly_limit: 0 },
];

const DEFAULT_SETTINGS = {
  currency: '₱',
  monthlyBudget: 0,
  expectedIncome: 0,
  savingsRate: 0.20, // default 20% savings rule when planning
  payCycle: 'semi-monthly', // 'semi-monthly' | 'monthly'
  paydays: [10, 25],
  salaryByPayday: { 10: 0, 25: 0 },
  theme: 'day', // 'day' | 'night'
  soundEnabled: true,
};

function getSampleTransactions() {
  return [];
}

const DEFAULT_RECURRING = [];

const DEFAULT_GOALS = [];

const FRESH_START_FLAG = 'lyka_clean_fresh_slate_v2';

class BudgetStore {
  constructor() {
    this.listeners = new Set();
    this.unsubscribers = [];
    this.isCloudSyncActive = false;
    this._notifyPending = false;
    this._needsCloudPurge = false;

    // Fresh start: wipe any legacy local data on first run
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(FRESH_START_FLAG)) {
      try {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('lyka_transactions_v2');
        localStorage.removeItem('lyka_cutoffs_v2');
        localStorage.removeItem('lyka_recurring_v2');
        localStorage.removeItem('lyka_goals_v2');
        localStorage.removeItem('lyka_settings_v2');
        localStorage.removeItem('lyka_categories_v2');
        localStorage.setItem(FRESH_START_FLAG, 'true');
        this._needsCloudPurge = true;
      } catch (_) {}
    }

    // Load initial fast state from localStorage
    this.categories = this.sanitizeCategories(this.load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES));
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.transactions = this.load(STORAGE_KEYS.TRANSACTIONS, []);
    this.recurring = this.load(STORAGE_KEYS.RECURRING, []);
    this.goals = this.load(STORAGE_KEYS.GOALS, []);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    this.cutoffs = this.load(STORAGE_KEYS.CUTOFFS, {});

    // Apply stored theme on init
    this.applyTheme(this.settings.theme);

    // Initialize Firebase Realtime Listeners if configured
    this.initFirebase();
  }

  sanitizeCategories(cats) {
    if (!Array.isArray(cats)) {
      return [...DEFAULT_CATEGORIES];
    }

    // Filter out invalid or unnamed categories, preserving all user-created categories
    let filtered = cats.filter(c => c && typeof c === 'object' && c.name && String(c.name).trim().length > 0);

    const standard = [
      { id: 'cat-bills', name: 'Bills', emoji: '', color: '#C8E6C9', monthly_limit: 0 },
      { id: 'cat-shopping', name: 'Shopping & Needs', emoji: '', color: '#E1BEE7', monthly_limit: 0 },
      { id: 'cat-daily', name: 'Cutoff Allowance', emoji: '', color: '#BFE3F7', monthly_limit: 0 },
      { id: 'cat-misc', name: 'Miscellaneous', emoji: '', color: '#FFE0B2', monthly_limit: 0 },
      { id: 'cat-income', name: 'Salary & Income', emoji: '', color: '#B2DFDB', monthly_limit: 0 },
    ];

    standard.forEach(std => {
      const existing = filtered.find(c => c.id === std.id || c.name.toLowerCase() === std.name.toLowerCase());
      if (!existing) {
        filtered.push(std);
      }
    });

    return filtered;
  }

  load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn(`Failed to read ${key} from localStorage:`, e);
      return fallback;
    }
  }

  save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn(`Failed to write ${key} to localStorage:`, e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    if (this._notifyPending) return;
    this._notifyPending = true;
    queueMicrotask(() => {
      this._notifyPending = false;
      this.listeners.forEach(fn => {
        try {
          fn(this);
        } catch (err) {
          console.error('Store listener error:', err);
        }
      });
    });
  }

  // --- FIREBASE REALTIME SETUP ---
  initFirebase() {
    if (!isFirebaseConfigured()) {
      this.isCloudSyncActive = false;
      setSyncStatus('offline');
      return;
    }

    const db = getDb();
    if (!db) {
      setSyncStatus('offline');
      return;
    }

    if (this._needsCloudPurge && db) {
      this._needsCloudPurge = false;
      this.clearAllData().catch(err => console.warn('Cloud purge error:', err));
      return;
    }

    setSyncStatus('syncing');

    // Unsubscribe previous listeners if any
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
    this.unsubscribers = [];

    try {
      // 1. Categories Realtime Listener
      const unsubCat = onSnapshot(collection(db, FS_COLLECTIONS.CATEGORIES), (snapshot) => {
        if (!snapshot.empty) {
          const remoteCats = [];
          snapshot.forEach(docSnap => remoteCats.push(docSnap.data()));

          // Merge: preserve local category monthly_limit if remote has 0
          const mergedCats = remoteCats.map(rc => {
            const local = this.categories.find(lc => lc.id === rc.id || lc.name.toLowerCase() === rc.name.toLowerCase());
            if (local && (local.monthly_limit > 0) && (!rc.monthly_limit || rc.monthly_limit === 0)) {
              return { ...rc, monthly_limit: local.monthly_limit };
            }
            return rc;
          });

          // Add any local categories not yet in remote
          this.categories.forEach(lc => {
            if (!mergedCats.some(mc => mc.id === lc.id || mc.name.toLowerCase() === lc.name.toLowerCase())) {
              mergedCats.push(lc);
              setDoc(doc(db, FS_COLLECTIONS.CATEGORIES, lc.id), lc).catch(() => {});
            }
          });

          this.categories = this.sanitizeCategories(mergedCats);
          this.save(STORAGE_KEYS.CATEGORIES, this.categories);
          setSyncStatus('synced');
          this.notify();
        } else if (this.categories && this.categories.length > 0) {
          // If Firestore is empty, seed it with current categories
          this.seedInitialData(db);
          setSyncStatus('synced');
          this.notify();
        }
      }, (err) => {
        console.warn('Categories sync error:', err);
        setSyncStatus('error');
      });
      this.unsubscribers.push(unsubCat);

      // 2. Transactions Realtime Listener
      const unsubTx = onSnapshot(collection(db, FS_COLLECTIONS.TRANSACTIONS), (snapshot) => {
        if (!snapshot.empty) {
          const remoteTx = [];
          snapshot.forEach(docSnap => remoteTx.push(docSnap.data()));

          // Intelligent merge by ID: ensure local offline transactions are preserved!
          const txMap = new Map();
          remoteTx.forEach(t => txMap.set(t.id, t));
          this.transactions.forEach(t => {
            if (!txMap.has(t.id)) {
              txMap.set(t.id, t);
              // Push local offline transaction to Firestore
              setDoc(doc(db, FS_COLLECTIONS.TRANSACTIONS, t.id), t).catch(() => {});
            }
          });

          const merged = Array.from(txMap.values());
          merged.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
          this.transactions = merged;
          this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
          setSyncStatus('synced');
          this.notify();
        } else if (this.transactions && this.transactions.length > 0) {
          // Firestore is empty but local has transactions! Push them up!
          const batch = writeBatch(db);
          this.transactions.forEach(t => batch.set(doc(db, FS_COLLECTIONS.TRANSACTIONS, t.id), t));
          batch.commit().catch(() => {});
          setSyncStatus('synced');
          this.notify();
        }
      }, (err) => {
        console.warn('Transactions sync error:', err);
        setSyncStatus('error');
      });
      this.unsubscribers.push(unsubTx);

      // 3. Recurring Realtime Listener
      const unsubRec = onSnapshot(collection(db, FS_COLLECTIONS.RECURRING), (snapshot) => {
        if (!snapshot.empty) {
          const remoteRec = [];
          snapshot.forEach(docSnap => remoteRec.push(docSnap.data()));
          const recMap = new Map();
          remoteRec.forEach(r => recMap.set(r.id, r));
          this.recurring.forEach(r => { if (!recMap.has(r.id)) recMap.set(r.id, r); });
          this.recurring = Array.from(recMap.values());
          this.save(STORAGE_KEYS.RECURRING, this.recurring);
          this.notify();
        } else if (this.recurring && this.recurring.length > 0) {
          const batch = writeBatch(db);
          this.recurring.forEach(r => batch.set(doc(db, FS_COLLECTIONS.RECURRING, r.id), r));
          batch.commit().catch(() => {});
        }
      }, (err) => console.warn('Recurring sync error:', err));
      this.unsubscribers.push(unsubRec);

      // 4. Goals Realtime Listener
      const unsubGoals = onSnapshot(collection(db, FS_COLLECTIONS.GOALS), (snapshot) => {
        if (!snapshot.empty) {
          const remoteGoals = [];
          snapshot.forEach(docSnap => remoteGoals.push(docSnap.data()));
          const goalsMap = new Map();
          remoteGoals.forEach(g => goalsMap.set(g.id, g));
          this.goals.forEach(g => { if (!goalsMap.has(g.id)) goalsMap.set(g.id, g); });
          this.goals = Array.from(goalsMap.values());
          this.save(STORAGE_KEYS.GOALS, this.goals);
          this.notify();
        } else if (this.goals && this.goals.length > 0) {
          const batch = writeBatch(db);
          this.goals.forEach(g => batch.set(doc(db, FS_COLLECTIONS.GOALS, g.id), g));
          batch.commit().catch(() => {});
        }
      }, (err) => console.warn('Goals sync error:', err));
      this.unsubscribers.push(unsubGoals);

      // 5. Cutoffs Realtime Listener
      const unsubCutoffs = onSnapshot(collection(db, FS_COLLECTIONS.CUTOFFS), (snapshot) => {
        if (!snapshot.empty) {
          const remoteCutoffs = {};
          snapshot.forEach(docSnap => {
            remoteCutoffs[docSnap.id] = docSnap.data();
          });

          // Intelligent merge with local cutoffs:
          const merged = { ...this.cutoffs };
          Object.keys(remoteCutoffs).forEach(id => {
            const localRec = merged[id] || {};
            const remoteRec = remoteCutoffs[id] || {};
            merged[id] = {
              ...localRec,
              ...remoteRec,
              categoryLimits: {
                ...(localRec.categoryLimits || {}),
                ...(remoteRec.categoryLimits || {}),
              },
              salaryConfirmed: Boolean(localRec.salaryConfirmed || remoteRec.salaryConfirmed),
              paycheckDismissed: Boolean(localRec.paycheckDismissed || remoteRec.paycheckDismissed),
            };
          });

          // Also check if local has cutoffs not yet in remote and upload them
          Object.keys(this.cutoffs || {}).forEach(id => {
            if (!remoteCutoffs[id]) {
              setDoc(doc(db, FS_COLLECTIONS.CUTOFFS, id), this.cutoffs[id], { merge: true }).catch(() => {});
            }
          });

          this.cutoffs = merged;
          this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
          this.notify();
        } else if (this.cutoffs && Object.keys(this.cutoffs).length > 0) {
          // Firestore cutoffs collection is empty but local has cutoffs! Push to cloud!
          const batch = writeBatch(db);
          Object.values(this.cutoffs).forEach(c => batch.set(doc(db, FS_COLLECTIONS.CUTOFFS, c.id), c));
          batch.commit().catch(() => {});
        }
      }, (err) => console.warn('Cutoffs sync error:', err));
      this.unsubscribers.push(unsubCutoffs);

      // 6. Settings Realtime Listener
      const unsubSettings = onSnapshot(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), (docSnap) => {
        if (docSnap.exists()) {
          const remoteSettings = docSnap.data();
          // Keep local theme preference so phone and desktop can choose independent dark/light mode
          const currentTheme = this.settings.theme;
          this.settings = { ...this.settings, ...remoteSettings, theme: currentTheme };
          this.save(STORAGE_KEYS.SETTINGS, this.settings);
          this.notify();
        }
      }, (err) => console.warn('Settings sync error:', err));
      this.unsubscribers.push(unsubSettings);

      this.isCloudSyncActive = true;
      this.notify();
    } catch (err) {
      console.error('Failed to attach Firebase listeners:', err);
      this.isCloudSyncActive = false;
    }
  }

  // Seed default collections if fresh database (categories & settings only)
  async seedInitialData(db) {
    try {
      const seeded = localStorage.getItem(STORAGE_KEYS.FIREBASE_INITIALIZED);
      if (seeded) return;

      const batch = writeBatch(db);
      this.categories.forEach(c => {
        batch.set(doc(db, FS_COLLECTIONS.CATEGORIES, c.id), c);
      });
      batch.set(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), {
        currency: this.settings.currency || '₱',
        monthlyBudget: parseFloat(this.settings.monthlyBudget) || 0,
        expectedIncome: parseFloat(this.settings.expectedIncome) || 0,
        savingsRate: this.settings.savingsRate ?? 0.20,
        payCycle: this.settings.payCycle || 'semi-monthly',
        paydays: this.settings.paydays || [10, 25],
        salaryByPayday: this.settings.salaryByPayday || { 10: 0, 25: 0 },
        soundEnabled: this.settings.soundEnabled ?? true,
      });

      await batch.commit();
      localStorage.setItem(STORAGE_KEYS.FIREBASE_INITIALIZED, 'true');
    } catch (e) {
      console.warn('Auto-seed to Firestore notice:', e);
    }
  }

  // Push all local data into Firebase manually
  async pushLocalDataToCloud() {
    const db = getDb();
    if (!db) throw new Error('Firebase is not initialized');

    const batch = writeBatch(db);
    this.categories.forEach(c => batch.set(doc(db, FS_COLLECTIONS.CATEGORIES, c.id), c));
    this.transactions.forEach(t => batch.set(doc(db, FS_COLLECTIONS.TRANSACTIONS, t.id), t));
    this.recurring.forEach(r => batch.set(doc(db, FS_COLLECTIONS.RECURRING, r.id), r));
    this.goals.forEach(g => batch.set(doc(db, FS_COLLECTIONS.GOALS, g.id), g));
    Object.values(this.cutoffs || {}).forEach(c => batch.set(doc(db, FS_COLLECTIONS.CUTOFFS, c.id), c));
    batch.set(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), {
      currency: this.settings.currency,
      monthlyBudget: this.settings.monthlyBudget,
      expectedIncome: this.settings.expectedIncome,
      savingsRate: this.settings.savingsRate ?? 0.2857,
      payCycle: this.settings.payCycle,
      paydays: this.settings.paydays,
      salaryByPayday: this.settings.salaryByPayday,
      soundEnabled: this.settings.soundEnabled,
    });

    await batch.commit();
    return true;
  }

  // --- SETTINGS & THEME ---
  getSettings() {
    return { ...this.settings };
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    this.save(STORAGE_KEYS.SETTINGS, this.settings);
    if (partial.theme) {
      this.applyTheme(partial.theme);
    }

    const db = getDb();
    if (db) {
      const syncData = { ...this.settings };
      delete syncData.theme; // Keep theme device-local
      setDoc(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), syncData, { merge: true }).catch(err => {
        console.warn('Firestore settings update error:', err);
      });
    }

    this.notify();
  }

  applyTheme(theme) {
    if (typeof document === 'undefined') return;
    if (theme === 'night') {
      document.documentElement.setAttribute('data-theme', 'night');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  toggleTheme() {
    const nextTheme = this.settings.theme === 'night' ? 'day' : 'night';
    this.updateSettings({ theme: nextTheme });
    return nextTheme;
  }

  // --- TRANSACTIONS ---
  getTransactions(filter = {}) {
    let list = [...this.transactions];
    if (filter.type && filter.type !== 'all') {
      list = list.filter(t => t.type === filter.type);
    }
    if (filter.categoryId && filter.categoryId !== 'all') {
      list = list.filter(t => t.categoryId === filter.categoryId);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(t =>
        (t.note && t.note.toLowerCase().includes(q)) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(q))
      );
    }
    if (filter.month) {
      list = list.filter(t => t.date && t.date.startsWith(filter.month));
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    return list;
  }

  addTransaction(tx) {
    const categoryId = tx.categoryId || tx.category;
    const category = this.categories.find(c => c.id === categoryId);
    const isIncome = tx.type === 'income' || categoryId === 'cat-income' || (category && category.name.toLowerCase().includes('income'));
    const newTx = {
      id: tx.id || ('tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      type: isIncome ? 'income' : 'expense',
      amount: parseFloat(tx.amount) || 0,
      categoryId: categoryId,
      categoryName: category ? category.name : (tx.categoryName || (isIncome ? 'Salary & Income' : 'General')),
      categoryEmoji: category ? category.emoji : (tx.categoryEmoji || ''),
      note: tx.note ? tx.note.trim() : '',
      date: tx.date instanceof Date ? toDateString(tx.date) : (tx.date || getTodayDateString()),
      recurringId: tx.recurringId || null,
      createdAt: tx.createdAt || new Date().toISOString(),
      isLoan: Boolean(tx.isLoan),
      borrowerName: tx.borrowerName || null,
      loanStatus: tx.loanStatus || (tx.isLoan ? 'unpaid' : null),
      repaidLoanId: tx.repaidLoanId || null,
    };

    // Calculate cutoff that this transaction belongs to
    const dateStr = typeof newTx.date === 'string' ? newTx.date : toDateString(newTx.date);
    const txDate = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    const cutoff = this.getCurrentCutoff(txDate);
    if (cutoff) {
      newTx.cutoffId = cutoff.id;
      newTx.cutoffLabel = cutoff.label;
    }

    // Safeguard: User must NOT log expenses when income is insufficient!
    // Savings must NEVER be compromised: only the spend budget is deducted by expenses.
    if (newTx.type === 'expense' && !tx.skipBudgetCheck) {
      const summary = this.getCutoffSummary(cutoff);
      const curr = this.settings.currency || '₱';

      if (summary.budgetLimit <= 0) {
        throw new Error(`Cannot log expense: No spend budget logged yet for cutoff ${cutoff.label}. Please log your income first.`);
      }

      if (newTx.amount > summary.remainingBudget) {
        throw new Error(`Insufficient budget! You only have ${formatCurrency(summary.remainingBudget, curr)} available to spend in this cutoff (${cutoff.label}). Savings of ${formatCurrency(summary.plan.savingsTarget, curr)} is strictly protected and cannot be compromised.`);
      }

      // Safeguard: Envelope / Allocation Budget Overlap Check
      if (categoryId) {
        const catSpending = this.getCutoffCategorySpending(cutoff);
        const catSpend = catSpending.find(c => c.id === categoryId);
        if (catSpend) {
          if (catSpend.totalFunds <= 0) {
            throw new Error(`Cannot ${newTx.isLoan ? 'lend from' : 'log expense for'} "${catSpend.name}": Envelope has no allocated budget in cutoff ${cutoff.label}. Please set a budget first in the Planner.`);
          }
          const catRemaining = catSpend.totalFunds - catSpend.spent;
          if (newTx.amount > catRemaining) {
            const actionWord = newTx.isLoan ? 'lend money' : 'log expense';
            throw new Error(`Cannot ${actionWord}: Exceeds "${catSpend.name}" envelope budget! Only ${formatCurrency(Math.max(0, catRemaining), curr)} remaining in this envelope (${formatCurrency(catSpend.spent, curr)} already spent of ${formatCurrency(catSpend.totalFunds, curr)}).`);
          }
        }
      }
    }

    this.transactions.unshift(newTx);
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    if (newTx.type === 'income') {
      try {
        if (cutoff) {
          const rec = this.getCutoffRecord(cutoff.id) || {};
          if (!rec.salaryConfirmed) {
            this.saveCutoffRecord({
              ...rec,
              id: cutoff.id,
              salaryConfirmed: true,
              salaryTxId: newTx.id,
              salaryAmount: newTx.amount,
              carriedIn: parseFloat(rec.carriedIn) || 0,
              confirmedAt: new Date().toISOString(),
            });
          }
        }
      } catch (e) {
        console.warn('Auto cutoff record update notice:', e);
      }
    }

    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.TRANSACTIONS, newTx.id), newTx).catch(err => {
        console.warn('Firestore add transaction error:', err);
      });
    }

    return newTx;
  }

  updateTransaction(id, updates) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    let category = null;
    if (updates.categoryId) {
      category = this.categories.find(c => c.id === updates.categoryId);
    }

    const updated = {
      ...this.transactions[idx],
      ...updates,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : this.transactions[idx].amount,
      categoryName: category ? category.name : (updates.categoryName || this.transactions[idx].categoryName),
      categoryEmoji: category ? category.emoji : (updates.categoryEmoji || this.transactions[idx].categoryEmoji),
    };

    if (updates.date && updates.date !== this.transactions[idx].date) {
      const txDate = new Date(updates.date + (updates.date.includes('T') ? '' : 'T00:00:00'));
      const cutoff = this.getCurrentCutoff(txDate);
      if (cutoff) {
        updated.cutoffId = cutoff.id;
        updated.cutoffLabel = cutoff.label;
      }
    }

    // Safeguard on update: check if updating an expense exceeds envelope or cutoff budget
    if (updated.type === 'expense' && !updates.skipBudgetCheck) {
      const oldTx = this.transactions[idx];
      const txDate = new Date((updated.date || '') + (String(updated.date).includes('T') ? '' : 'T00:00:00'));
      const cutoff = this.getCurrentCutoff(txDate);
      if (cutoff) {
        const summary = this.getCutoffSummary(cutoff);
        const curr = this.settings.currency || '₱';

        let effectiveCutoffRem = summary.remainingBudget;
        if (oldTx.type === 'expense' && isDateInRange(oldTx.date, cutoff.start, cutoff.end)) {
          effectiveCutoffRem += (parseFloat(oldTx.amount) || 0);
        }

        if (summary.budgetLimit <= 0) {
          throw new Error(`Cannot update expense: No spend budget logged yet for cutoff ${cutoff.label}. Please log your income first.`);
        }
        if (updated.amount > effectiveCutoffRem) {
          throw new Error(`Insufficient budget! You only have ${formatCurrency(effectiveCutoffRem, curr)} available to spend in this cutoff (${cutoff.label}). Savings is protected.`);
        }

        if (updated.categoryId) {
          const catSpending = this.getCutoffCategorySpending(cutoff);
          const catSpend = catSpending.find(c => c.id === updated.categoryId);
          if (catSpend) {
            let effectiveCatRem = catSpend.totalFunds - catSpend.spent;
            if (oldTx.type === 'expense' && oldTx.categoryId === updated.categoryId && isDateInRange(oldTx.date, cutoff.start, cutoff.end)) {
              effectiveCatRem += (parseFloat(oldTx.amount) || 0);
            }
            if (catSpend.totalFunds <= 0) {
              throw new Error(`Cannot update expense for "${catSpend.name}": Envelope has no allocated budget in cutoff ${cutoff.label}.`);
            }
            if (updated.amount > effectiveCatRem) {
              throw new Error(`Cannot update expense: Exceeds "${catSpend.name}" envelope budget! Only ${formatCurrency(Math.max(0, effectiveCatRem), curr)} remaining in this envelope.`);
            }
          }
        }
      }
    }

    this.transactions[idx] = updated;
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    // If updated transaction was linked as a cutoff salary confirmation, sync the salaryAmount
    if (updated.type === 'income' && this.cutoffs) {
      Object.keys(this.cutoffs).forEach(cutoffId => {
        const rec = this.cutoffs[cutoffId];
        if (rec && rec.salaryTxId === id) {
          rec.salaryAmount = updated.amount;
          this.saveCutoffRecord(rec);
        }
      });
    }

    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.TRANSACTIONS, id), updated).catch(err => {
        console.warn('Firestore update transaction error:', err);
      });
    }

    return updated;
  }

  deleteTransaction(id) {
    const deleted = this.transactions.find(t => t.id === id);
    if (!deleted) return null;
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    // If deleted transaction was linked as a cutoff salary confirmation, unconfirm it
    if (deleted.type === 'income' && this.cutoffs) {
      Object.keys(this.cutoffs).forEach(cutoffId => {
        const rec = this.cutoffs[cutoffId];
        if (rec && rec.salaryTxId === id) {
          rec.salaryConfirmed = false;
          delete rec.salaryTxId;
          delete rec.salaryAmount;
          this.saveCutoffRecord(rec);
        }
      });
    }

    // If deleted transaction was a paid recurring item, sync with recurring bills
    if (deleted.recurringId) {
      const recurringItem = this.recurring.find(r => r.id === deleted.recurringId);
      if (recurringItem && recurringItem.lastPaid === deleted.date) {
        this.unmarkRecurringPaid(recurringItem.id);
      }
    }

    this.notify();

    const db = getDb();
    if (db) {
      deleteDoc(doc(db, FS_COLLECTIONS.TRANSACTIONS, id)).catch(err => {
        console.warn('Firestore delete transaction error:', err);
      });
    }

    return deleted;
  }

  // --- CATEGORIES ---
  getCategories() {
    return [...this.categories];
  }

  addCategory(cat) {
    const newCat = {
      id: cat.id || ('cat-' + Date.now()),
      name: cat.name.trim(),
      emoji: cat.emoji || '🏷️',
      color: cat.color || '#BFE3F7',
      monthly_limit: parseFloat(cat.monthly_limit || 0),
    };
    this.categories.push(newCat);
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.CATEGORIES, newCat.id), newCat).catch(err => {
        console.warn('Firestore add category error:', err);
      });
    }

    return newCat;
  }

  updateCategory(id, updates) {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.categories[idx] = {
      ...this.categories[idx],
      ...updates,
      monthly_limit: updates.monthly_limit !== undefined ? parseFloat(updates.monthly_limit) : this.categories[idx].monthly_limit,
    };
    const updated = this.categories[idx];
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.CATEGORIES, id), updated).catch(err => {
        console.warn('Firestore update category error:', err);
      });
    }

    return updated;
  }

  deleteCategory(id) {
    this.categories = this.categories.filter(c => c.id !== id);
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.notify();

    const db = getDb();
    if (db) {
      deleteDoc(doc(db, FS_COLLECTIONS.CATEGORIES, id)).catch(err => {
        console.warn('Firestore delete category error:', err);
      });
    }
  }

  updateCategoryLimit(id, limit) {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      const monthly_limit = Math.max(0, parseFloat(limit) || 0);
      this.categories[idx].monthly_limit = monthly_limit;
      this.save(STORAGE_KEYS.CATEGORIES, this.categories);
      this.notify();

      const db = getDb();
      if (db) {
        updateDoc(doc(db, FS_COLLECTIONS.CATEGORIES, id), { monthly_limit }).catch(err => {
          console.warn('Firestore limit update error:', err);
        });
      }
    }
  }

  async resetToStandardEnvelopes() {
    const defaultCats = [
      { id: 'cat-bills', name: 'Bills', emoji: '', color: '#C8E6C9', monthly_limit: 0 },
      { id: 'cat-shopping', name: 'Shopping & Needs', emoji: '', color: '#E1BEE7', monthly_limit: 0 },
      { id: 'cat-daily', name: 'Cutoff Allowance', emoji: '', color: '#BFE3F7', monthly_limit: 0 },
      { id: 'cat-misc', name: 'Miscellaneous', emoji: '', color: '#FFE0B2', monthly_limit: 0 },
      { id: 'cat-income', name: 'Salary & Income', emoji: '', color: '#B2DFDB', monthly_limit: 0 },
    ];

    const db = getDb();
    if (db) {
      try {
        const batch = writeBatch(db);
        this.categories.forEach(c => {
          batch.delete(doc(db, FS_COLLECTIONS.CATEGORIES, c.id));
        });
        defaultCats.forEach(c => {
          batch.set(doc(db, FS_COLLECTIONS.CATEGORIES, c.id), c);
        });
        await batch.commit();
      } catch (err) {
        console.warn('Error resetting categories in Firestore:', err);
      }
    }

    this.categories = defaultCats;
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.notify();
    return defaultCats;
  }

  // --- SAVINGS & PLANNING HELPERS ---
  getSavingsRate() {
    if (this.settings.savingsRate !== undefined && this.settings.savingsRate !== null) {
      const rate = parseFloat(this.settings.savingsRate);
      if (!isNaN(rate)) {
        return Math.max(0, Math.min(0.95, rate));
      }
    }
    const expected = parseFloat(this.settings.expectedIncome) || 0;
    const budget = parseFloat(this.settings.monthlyBudget) || 0;
    if (expected > 0 && budget > 0) {
      const computed = (expected - budget) / expected;
      return Math.max(0, Math.min(0.95, computed));
    }
    return 0.20;
  }

  getCutoffPlan(cutoff = this.getCurrentCutoff()) {
    const isSemi = (this.settings.payCycle || 'semi-monthly') === 'semi-monthly';
    const periodTx = this.transactions.filter(
      t => t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );

    const loggedIncome = periodTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const record = this.getCutoffRecord(cutoff.id);
    const expectedSalary = (record && record.expectedSalary !== undefined)
      ? parseFloat(record.expectedSalary)
      : (isSemi
          ? ((this.settings.salaryByPayday && this.settings.salaryByPayday[cutoff.payday] !== undefined)
              ? parseFloat(this.settings.salaryByPayday[cutoff.payday])
              : (Math.round((parseFloat(this.settings.expectedIncome) || 0) / 2)))
          : (parseFloat(this.settings.expectedIncome) || 0));

    const isExpected = loggedIncome <= 0;
    const paycheck = isExpected ? expectedSalary : loggedIncome;

    const savingsRate = (record && record.savingsRate !== undefined) ? record.savingsRate : this.getSavingsRate();
    const savingsTarget = Math.round(paycheck * savingsRate);

    const carriedIn = record ? (parseFloat(record.carriedIn) || 0) : 0;

    let spendBudget = Math.max(0, paycheck - savingsTarget + carriedIn);
    // Only use customSpendBudget if expected salary mode and custom limit was explicitly saved
    if (isExpected && record && record.customSpendBudget !== undefined) {
      spendBudget = Math.max(0, parseFloat(record.customSpendBudget) + carriedIn);
    }

    return {
      cutoff,
      paycheck,
      loggedIncome,
      expectedSalary,
      isExpected,
      savingsRate,
      savingsTarget,
      carriedIn,
      spendBudget,
      record,
    };
  }

  getMonthPlan(yearMonth = getCurrentMonthKey()) {
    const monthTx = this.transactions.filter(
      t => t.date && t.date.startsWith(yearMonth)
    );
    const loggedIncome = monthTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const expectedIncome = parseFloat(this.settings.expectedIncome) || 0;
    const isExpected = loggedIncome <= 0;
    const paycheck = isExpected ? expectedIncome : loggedIncome;
    const savingsRate = this.getSavingsRate();
    const savingsTarget = Math.round(paycheck * savingsRate);
    const spendBudget = Math.max(0, paycheck - savingsTarget);
    return {
      yearMonth,
      paycheck,
      loggedIncome,
      expectedIncome,
      isExpected,
      savingsRate,
      savingsTarget,
      spendBudget,
    };
  }

  // --- CUTOFF & PERIOD HELPERS ---
  getCurrentCutoff(date = new Date()) {
    return getCutoffForDate(date, this.settings.paydays || [10, 25], this.settings.payCycle || 'semi-monthly');
  }

  getCutoffRecord(id) {
    return (this.cutoffs && this.cutoffs[id]) || null;
  }

  saveCutoffRecord(record) {
    if (!this.cutoffs) this.cutoffs = {};
    const existing = this.cutoffs[record.id] || {};
    const merged = {
      ...existing,
      ...record,
      categoryLimits: {
        ...(existing.categoryLimits || {}),
        ...(record.categoryLimits || {}),
      },
    };
    this.cutoffs[record.id] = merged;
    this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.CUTOFFS, record.id), merged, { merge: true }).catch(err => {
        console.warn('Firestore cutoff update error:', err);
      });
    }
    return merged;
  }

  getCutoffSummary(cutoff = this.getCurrentCutoff()) {
    const plan = this.getCutoffPlan(cutoff);
    const periodTx = this.transactions.filter(
      t => t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );

    let totalIncome = 0;
    let totalExpense = 0;
    let billsTotal = 0;
    let unpaidLoansTotal = 0;
    let totalLoans = 0;

    periodTx.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
      } else if (t.type === 'expense') {
        const isLoan = !!t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'));
        if (isLoan) {
          totalLoans += amt;
          if (t.loanStatus !== 'repaid') {
            unpaidLoansTotal += amt;
          }
          return;
        }

        totalExpense += amt;
        const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
        if (isBill) {
          billsTotal += amt;
        }
      }
    });

    // Unpaid loans directly reduce the available spend budget
    const budgetLimit = Math.max(0, plan.spendBudget - unpaidLoansTotal);
    const remainingBudget = Math.max(0, budgetLimit - totalExpense);
    const usagePercent = budgetLimit > 0 ? (totalExpense / budgetLimit) * 100 : 0;
    const isTight = budgetLimit > 0 && remainingBudget > 0 && (remainingBudget <= budgetLimit * 0.20 || usagePercent >= 80);
    const isExhausted = budgetLimit > 0 && remainingBudget <= 0;

    return {
      cutoff,
      record: plan.record,
      plan,
      totalIncome,
      totalExpense,
      billsTotal,
      unpaidLoansTotal,
      totalLoans,
      dailyExpense: Math.max(0, totalExpense - billsTotal),
      carriedIn: plan.carriedIn,
      baseBudget: plan.paycheck - plan.savingsTarget,
      budgetLimit,
      rawBudgetLimit: plan.spendBudget,
      remainingBudget,
      usagePercent,
      isTight,
      isExhausted,
      mood: usagePercent > 100 ? 'sad' : usagePercent >= 70 ? 'worried' : 'happy',
    };
  }

  getCutoffCategorySpending(cutoff = this.getCurrentCutoff()) {
    const isSemi = (this.settings.payCycle || 'semi-monthly') === 'semi-monthly';
    const plan = this.getCutoffPlan(cutoff);
    const periodTx = this.transactions.filter(
      t => t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );

    const spendMap = {};
    const depositMap = {};
    const loanMap = {};

    periodTx.forEach(t => {
      const catId = t.categoryId || 'cat-general';
      const amt = parseFloat(t.amount) || 0;

      if (t.type === 'expense') {
        const isLoan = !!t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'));
        if (isLoan) {
          if (!loanMap[catId]) {
            loanMap[catId] = { unpaidTotal: 0, total: 0 };
          }
          loanMap[catId].total += amt;
          if (t.loanStatus !== 'repaid') {
            loanMap[catId].unpaidTotal += amt;
          }
          return;
        }

        if (!spendMap[catId]) {
          spendMap[catId] = {
            categoryId: catId,
            name: t.categoryName || 'General',
            emoji: t.categoryEmoji || '',
            total: 0,
            billsTotal: 0,
          };
        }
        spendMap[catId].total += amt;
        const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
        if (isBill) {
          spendMap[catId].billsTotal += amt;
        }
      } else if (t.type === 'income') {
        // Income deposited directly to an envelope (e.g. Misc Envelope or leftover cash)
        // If this is a repayment of a loan borrowed in this SAME cutoff,
        // it restores the loan (origLoan.loanStatus === 'repaid', so unpaidTotal is already 0)
        if (t.repaidLoanId) {
          const origLoan = this.transactions.find(orig => orig.id === t.repaidLoanId);
          if (origLoan && isDateInRange(origLoan.date, cutoff.start, cutoff.end)) {
            return;
          }
        }
        if (!depositMap[catId]) {
          depositMap[catId] = { total: 0 };
        }
        depositMap[catId].total += amt;
      }
    });

    const nominalSum = this.categories.reduce((acc, c) => acc + ((c.monthly_limit || 0) / 2), 0);

    return this.categories
      .map(cat => {
        const spent = spendMap[cat.id] ? spendMap[cat.id].total : 0;
        const billsSpent = spendMap[cat.id] ? spendMap[cat.id].billsTotal : 0;
        const deposited = (cat.id !== 'cat-income' && depositMap[cat.id]) ? depositMap[cat.id].total : 0;
        const unpaidLoans = loanMap[cat.id] ? loanMap[cat.id].unpaidTotal : 0;
        const totalLoans = loanMap[cat.id] ? loanMap[cat.id].total : 0;

        const monthlyLimit = cat.monthly_limit || 0;
        const nominalHalf = isSemi ? Math.round(monthlyLimit / 2) : monthlyLimit;

        // Specific cutoff limit takes precedence if set, otherwise scale proportionally
        let allocatedLimit = 0;
        if (plan.record && plan.record.categoryLimits && plan.record.categoryLimits[cat.id] !== undefined) {
          allocatedLimit = parseFloat(plan.record.categoryLimits[cat.id]) || 0;
        } else if (isSemi && nominalSum > 0 && monthlyLimit > 0) {
          const ratio = (monthlyLimit / 2) / nominalSum;
          allocatedLimit = Math.round(plan.spendBudget * ratio);
        } else if (!isSemi && this.settings.monthlyBudget > 0 && monthlyLimit > 0) {
          const ratio = monthlyLimit / (this.settings.monthlyBudget || 1);
          allocatedLimit = Math.round(plan.spendBudget * ratio);
        } else if (nominalHalf > 0) {
          allocatedLimit = nominalHalf;
        }

        // Base funds before loan deductions:
        const baseFunds = allocatedLimit + deposited;
        // User rule: If budget is set to 2000 and 1000 is borrowed, the set budget is only 1000!
        // That 1000 is the base until repaid; when repaid, the repaid amount restores the budget.
        const effectiveLimit = Math.max(0, baseFunds - unpaidLoans);
        const totalFunds = effectiveLimit;
        const limit = effectiveLimit;
        const remaining = effectiveLimit - spent;

        const percent = totalFunds > 0 ? Math.min(100, Math.round((spent / totalFunds) * 100)) : (spent > 0 ? 100 : 0);
        const isExceeded = (totalFunds > 0 && spent > totalFunds) || (totalFunds === 0 && spent > 0);

        return {
          ...cat,
          monthly_limit: monthlyLimit,
          allocatedLimit,
          baseFunds,
          deposited,
          unpaidLoans,
          totalLoans,
          totalFunds,
          period_limit: limit,
          spent,
          billsSpent,
          dailySpent: Math.max(0, spent - billsSpent),
          percent,
          remaining: Math.max(0, remaining),
          remainingRaw: remaining,
          isExceeded,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }

  updateCutoffCategoryLimit(cutoffId, catId, limit) {
    const record = this.getCutoffRecord(cutoffId) || { id: cutoffId };
    if (!record.categoryLimits) record.categoryLimits = {};
    const cutoffLimit = Math.max(0, parseFloat(limit) || 0);
    record.categoryLimits[catId] = cutoffLimit;
    this.saveCutoffRecord(record);

    // Keep baseline category monthly limit aligned
    const idx = this.categories.findIndex(c => c.id === catId);
    if (idx !== -1) {
      this.categories[idx].monthly_limit = cutoffLimit * 2;
      this.save(STORAGE_KEYS.CATEGORIES, this.categories);

      const db = getDb();
      if (db) {
        updateDoc(doc(db, FS_COLLECTIONS.CATEGORIES, catId), { monthly_limit: cutoffLimit * 2 }).catch(err => {
          console.warn('Firestore category limit update error:', err);
        });
      }
    }

    this.notify();
  }

  applyCutoff503020Rule(cutoffId, paycheckVal) {
    const curCutoff = this.getCurrentCutoff();
    const cutoff = (this.cutoffs && this.cutoffs[cutoffId]) || curCutoff;
    const plan = this.getCutoffPlan(cutoff);
    const paycheck = parseFloat(paycheckVal) || plan.paycheck;

    const needs = paycheck * 0.50; // 50%
    const wants = paycheck * 0.30; // 30%
    const spendBudget = Math.round(needs + wants);

    const record = this.getCutoffRecord(cutoffId) || { id: cutoffId };
    record.categoryLimits = {
      'cat-bills': Math.round(needs * 0.50),
      'cat-daily': Math.round(needs * 0.50),
      'cat-shopping': Math.round(wants * 0.60),
      'cat-misc': Math.round(wants * 0.40),
    };
    record.savingsRate = 0.20;
    record.customSpendBudget = spendBudget;
    this.saveCutoffRecord(record);

    // Align categories baseline
    Object.entries(record.categoryLimits).forEach(([catId, cLimit]) => {
      const idx = this.categories.findIndex(c => c.id === catId);
      if (idx !== -1) {
        this.categories[idx].monthly_limit = cLimit * 2;
      }
    });
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);

    const db = getDb();
    if (db) {
      Object.entries(record.categoryLimits).forEach(([catId, cLimit]) => {
        updateDoc(doc(db, FS_COLLECTIONS.CATEGORIES, catId), { monthly_limit: cLimit * 2 }).catch(() => {});
      });
    }

    this.notify();
  }

  getPendingPayday() {
    if ((this.settings.payCycle || 'semi-monthly') !== 'semi-monthly') return null;
    const curCutoff = this.getCurrentCutoff();
    const record = this.getCutoffRecord(curCutoff.id);
    const plan = this.getCutoffPlan(curCutoff);
    const hasLoggedIncome = plan.loggedIncome > 0;

    // Check if user already confirmed or entered paycheck for this cutoff:
    // 1. Cutoff record has salaryConfirmed === true
    // 2. Cutoff record has paycheckDismissed === true
    // 3. Or income matching salary has already been logged for this cutoff
    const hasSalaryTx = this.transactions.some(
      t => t.type === 'income' &&
        (t.cutoffId === curCutoff.id || isDateInRange(t.date, curCutoff.start, curCutoff.end)) &&
        (t.categoryId === 'cat-income' || (t.note && (t.note.toLowerCase().includes('salary') || t.note.toLowerCase().includes('paycheck'))))
    );

    const isAlreadyDone = Boolean(
      (record && (record.salaryConfirmed || record.paycheckDismissed)) ||
      hasSalaryTx ||
      (hasLoggedIncome && record && record.salaryConfirmed)
    );

    if (isAlreadyDone) {
      return null;
    }

    const paydays = this.settings.paydays || [10, 25];
    const prevCutoff = getPreviousCutoff(curCutoff, paydays);
    const prevSummary = this.getCutoffSummary(prevCutoff);
    const leftover = Math.max(
      0,
      prevSummary.remainingBudget || 0,
      (prevSummary.totalIncome - prevSummary.totalExpense) || 0
    );

    const scheduledSalary = (this.settings.salaryByPayday && this.settings.salaryByPayday[curCutoff.payday] !== undefined)
      ? parseFloat(this.settings.salaryByPayday[curCutoff.payday])
      : Math.round((parseFloat(this.settings.expectedIncome) || 0) / 2);

    return {
      cutoff: curCutoff,
      salary: scheduledSalary > 0 ? scheduledSalary : (plan.loggedIncome || 0),
      isPayday: paydays.includes(new Date().getDate()),
      hasLoggedIncome,
      previous: {
        cutoff: prevCutoff,
        leftover,
      },
    };
  }

  dismissPayday(cutoffId = this.getCurrentCutoff().id) {
    const record = this.getCutoffRecord(cutoffId) || { id: cutoffId };
    record.paycheckDismissed = true;
    this.saveCutoffRecord(record);
  }

  confirmPayday({ amount, leftoverAction = 'save', goalId, envelopeId, note } = {}) {
    const curCutoff = this.getCurrentCutoff();
    const defaultSalary = (this.settings.salaryByPayday && this.settings.salaryByPayday[curCutoff.payday] !== undefined)
      ? parseFloat(this.settings.salaryByPayday[curCutoff.payday])
      : Math.round((parseFloat(this.settings.expectedIncome) || 0) / 2);
    const amountVal = parseFloat(amount) || defaultSalary || 0;

    // 1. Log Income if amount > 0
    let tx = null;
    if (amountVal > 0) {
      tx = this.addTransaction({
        type: 'income',
        amount: amountVal,
        categoryId: 'cat-income',
        categoryName: 'Salary & Income',
        categoryEmoji: '',
        note: note || `Salary – ${curCutoff.label} (${curCutoff.payday}th Cutoff)`,
        date: getTodayDateString(),
      });
    }

    // 2. Handle leftover from previous cutoff (supports savings goal OR depositing into envelope like Misc!)
    const paydays = this.settings.paydays || [10, 25];
    const prevCutoff = getPreviousCutoff(curCutoff, paydays);
    const prevSummary = this.getCutoffSummary(prevCutoff);
    const leftoverAmount = Math.max(
      0,
      prevSummary.remainingBudget || 0,
      (prevSummary.totalIncome - prevSummary.totalExpense) || 0
    );

    const action = leftoverAction || 'save';
    let carriedIn = 0;
    let targetGoalId = goalId || null;
    let targetEnvId = envelopeId || null;

    if (leftoverAmount > 0) {
      if (action === 'envelope') {
        const envCat = this.categories.find(c => c.id === targetEnvId) || this.categories.find(c => c.id === 'cat-misc') || this.categories[0];
        targetEnvId = envCat ? envCat.id : 'cat-misc';
        this.addTransaction({
          type: 'income',
          amount: leftoverAmount,
          categoryId: targetEnvId,
          categoryName: envCat ? envCat.name : 'Miscellaneous',
          note: `Excess from last cutoff (${prevCutoff.label})`,
          date: getTodayDateString(),
        });
      } else if (action === 'save') {
        if (targetGoalId && targetGoalId !== 'auto-savings' && this.goals.some(g => g.id === targetGoalId)) {
          this.contributeToGoal(targetGoalId, leftoverAmount);
        } else if (this.goals.length > 0) {
          targetGoalId = this.goals[0].id;
          this.contributeToGoal(targetGoalId, leftoverAmount);
        } else {
          // If no goals exist yet, automatically create Emergency Savings goal with leftover amount
          const newGoal = this.addGoal({
            name: 'Emergency Savings',
            targetAmount: Math.max(20000, Math.round(leftoverAmount * 2)),
            currentAmount: leftoverAmount,
            emoji: '',
            deadline: '',
          });
          targetGoalId = newGoal.id;
        }
      } else if (action === 'carry') {
        carriedIn = leftoverAmount;
      }
    }

    const existingRecord = this.getCutoffRecord(curCutoff.id) || {};
    const record = {
      ...existingRecord,
      id: curCutoff.id,
      salaryConfirmed: true,
      salaryTxId: tx ? tx.id : (existingRecord.salaryTxId || null),
      salaryAmount: amountVal,
      carriedIn,
      leftoverAction: action,
      leftoverAmount,
      leftoverGoalId: targetGoalId,
      leftoverEnvId: targetEnvId,
      confirmedAt: new Date().toISOString(),
    };

    this.saveCutoffRecord(record);
    return record;
  }

  // --- LOAN / HIRAM (MONEY LENT OUT) HELPERS ---
  repayLoan(txId) {
    const tx = this.transactions.find(t => t.id === txId);
    if (!tx) return null;

    // Update loan status to 'repaid'
    tx.loanStatus = 'repaid';
    tx.repaidAt = new Date().toISOString();
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.TRANSACTIONS, tx.id), {
        loanStatus: 'repaid',
        repaidAt: tx.repaidAt,
      }).catch(err => console.warn('Firestore loan repay update error:', err));
    }

    // Automatically deposit repaid money back into the exact envelope it was deducted from
    const repaymentTx = this.addTransaction({
      type: 'income',
      amount: tx.amount,
      categoryId: tx.categoryId,
      categoryName: tx.categoryName,
      note: `${tx.borrowerName || 'Borrower'} (repaid hiram)`,
      date: getTodayDateString(),
      repaidLoanId: tx.id,
    });

    this.notify();
    return { originalTx: tx, repaymentTx };
  }

  getAllLoans() {
    return this.transactions.filter(
      t => Boolean(t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)')))
    ).sort((a, b) => {
      // Unpaid loans first, then newest first
      const aUnpaid = a.loanStatus !== 'repaid';
      const bUnpaid = b.loanStatus !== 'repaid';
      if (aUnpaid && !bUnpaid) return -1;
      if (!aUnpaid && bUnpaid) return 1;
      return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
    });
  }

  getCutoffLoans(cutoff = this.getCurrentCutoff()) {
    return this.transactions.filter(
      t => (t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'))) &&
        t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );
  }

  // --- DAILY CALENDAR & SPENDING HELPERS ---
  getDailySpending(start, end) {
    const expenses = this.transactions.filter(
      t => t.type === 'expense' && t.date && (!start || t.date >= start) && (!end || t.date <= end)
    );
    const map = {};
    expenses.forEach(t => {
      const d = t.date;
      if (!map[d]) {
        map[d] = {
          date: d,
          totalSpent: 0,
          spent: 0, // non-bill, non-loan consumable spending
          billsSpent: 0,
          loansLent: 0,
          txs: [],
        };
      }
      map[d].totalSpent += t.amount;
      const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
      const isLoan = !!t.isLoan || (t.note && t.note.toLowerCase().includes('(hiram)'));
      if (isBill) {
        map[d].billsSpent += t.amount;
      } else if (isLoan) {
        map[d].loansLent = (map[d].loansLent || 0) + t.amount;
      } else {
        map[d].spent += t.amount;
      }
      map[d].txs.push(t);
    });
    return map;
  }

  getDailyLimit(dateStr = getTodayDateString()) {
    const isSemi = (this.settings.payCycle || 'semi-monthly') === 'semi-monthly';
    if (isSemi) {
      const cutoff = getCutoffForDate(dateStr, this.settings.paydays || [10, 25]);
      const plan = this.getCutoffPlan(cutoff);
      return Math.max(1, plan.spendBudget / cutoff.totalDays);
    } else {
      const parts = dateStr.split('-');
      const y = parseInt(parts[0], 10) || new Date().getFullYear();
      const m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
      const totalDays = new Date(y, m, 0).getDate();
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const plan = this.getMonthPlan(ym);
      return Math.max(1, plan.spendBudget / totalDays);
    }
  }

  getDayStatus(dateStr) {
    const todayStr = getTodayDateString();
    const isFuture = dateStr > todayStr;
    const spendingMap = this.getDailySpending(dateStr, dateStr);
    const dayData = spendingMap[dateStr] || { totalSpent: 0, spent: 0, billsSpent: 0, loansLent: 0, txs: [] };
    const limit = this.getDailyLimit(dateStr);

    const dayNum = parseInt(dateStr.slice(8, 10), 10);
    const paydays = this.settings.paydays || [10, 25];
    const isPayday = paydays.includes(dayNum);

    const cutoff = getCutoffForDate(dateStr, paydays);

    let status = 'none';
    if (isFuture) {
      status = 'future';
    } else if (dayData.spent === 0 && dayData.billsSpent === 0) {
      status = 'zero';
    } else if (dayData.spent < limit * 0.8) {
      status = 'under';
    } else if (dayData.spent <= limit) {
      status = 'close';
    } else {
      status = 'over';
    }

    return {
      date: dateStr,
      dayNum,
      isFuture,
      isToday: dateStr === todayStr,
      isPayday,
      periodType: cutoff.periodType, // 'A' | 'B'
      periodId: cutoff.id,
      spent: dayData.spent,
      billsSpent: dayData.billsSpent,
      loansLent: dayData.loansLent || 0,
      totalSpent: dayData.spent + dayData.billsSpent,
      limit,
      ratio: limit > 0 ? (dayData.spent / limit) : 0,
      status,
      txs: dayData.txs,
    };
  }

  getTodayAllowance() {
    const todayStr = getTodayDateString();
    const isSemi = (this.settings.payCycle || 'semi-monthly') === 'semi-monthly';
    const dayStatus = this.getDayStatus(todayStr);

    if (isSemi) {
      const cutoff = this.getCurrentCutoff();
      const summary = this.getCutoffSummary(cutoff);
      // Allowance for today = remainingBudget / daysLeft
      const todayAllowance = Math.max(0, summary.remainingBudget / cutoff.daysLeft);
      const todayLeft = Math.max(0, todayAllowance - dayStatus.spent);

      return {
        todayAllowance,
        spentToday: dayStatus.spent,
        billsToday: dayStatus.billsSpent,
        totalSpentToday: dayStatus.totalSpent,
        todayLeft,
        dailyLimit: this.getDailyLimit(todayStr),
        daysLeftInCutoff: cutoff.daysLeft,
        nextPayday: cutoff.nextPayday,
        daysToPayday: cutoff.daysLeft,
        cutoff,
        summary,
        isTight: summary.isTight,
        isExhausted: summary.isExhausted,
      };
    } else {
      const allowance = this.getDailyAllowance();
      const todayAllowance = allowance.dailySafeSpend;
      const todayLeft = Math.max(0, todayAllowance - dayStatus.spent);
      return {
        todayAllowance,
        spentToday: dayStatus.spent,
        billsToday: dayStatus.billsSpent,
        totalSpentToday: dayStatus.totalSpent,
        todayLeft,
        dailyLimit: this.getDailyLimit(todayStr),
        daysLeftInCutoff: allowance.daysRemaining,
        nextPayday: null,
        daysToPayday: allowance.daysRemaining,
        cutoff: null,
        summary: this.getMonthSummary(),
      };
    }
  }

  // --- BUDGET PLANNER HELPERS ---
  getDailyAllowance() {
    const isSemi = (this.settings.payCycle || 'semi-monthly') === 'semi-monthly';
    if (isSemi) {
      const cutoff = this.getCurrentCutoff();
      const summary = this.getCutoffSummary(cutoff);
      const dailySafeSpend = Math.max(0, summary.remainingBudget / cutoff.daysLeft);
      return {
        daysRemaining: cutoff.daysLeft,
        totalDays: cutoff.totalDays,
        currentDay: new Date().getDate(),
        dailySafeSpend,
        remainingBudget: summary.remainingBudget,
        cutoff,
      };
    }

    const now = new Date();
    const currentDay = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, (lastDayOfMonth - currentDay) + 1);

    const summary = this.getMonthSummary();
    const remainingBudget = summary.remainingBudget;
    const dailySafeSpend = Math.max(0, remainingBudget / daysRemaining);

    return {
      daysRemaining,
      totalDays: lastDayOfMonth,
      currentDay,
      dailySafeSpend,
      remainingBudget,
      cutoff: null,
    };
  }

  apply503020Rule(incomeVal) {
    const income = parseFloat(incomeVal) || (parseFloat(this.settings.expectedIncome) || 0);
    if (income <= 0) return;
    const plannedBudget = Math.round(income * 0.8); // 80% total spending cap (50% needs + 30% wants)

    this.updateSettings({
      expectedIncome: income,
      monthlyBudget: plannedBudget,
      savingsRate: 0.20,
    });

    const needs = income * 0.50; // Needs 50%
    const wants = income * 0.30; // Wants 30%

    // Allocate to default categories if present
    this.updateCategoryLimit('cat-bills', Math.round(needs * 0.50));
    this.updateCategoryLimit('cat-daily', Math.round(needs * 0.50));
    this.updateCategoryLimit('cat-shopping', Math.round(wants * 0.60));
    this.updateCategoryLimit('cat-misc', Math.round(wants * 0.40));

    this.notify();
  }

  // --- RECURRING BILLS ---
  getRecurring() {
    return [...this.recurring];
  }

  addRecurring(item) {
    const newItem = {
      id: item.id || ('rec-' + Date.now()),
      name: item.name.trim(),
      amount: parseFloat(item.amount),
      categoryId: item.categoryId,
      frequency: item.frequency || 'monthly',
      dueDay: parseInt(item.dueDay) || 1,
      nextDue: item.nextDue || getTodayDateString(),
      isActive: true,
    };
    this.recurring.push(newItem);
    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.RECURRING, newItem.id), newItem).catch(err => {
        console.warn('Firestore add recurring error:', err);
      });
    }

    return newItem;
  }

  isRecurringPaidThisMonth(item) {
    if (!item) return false;
    const currentMonth = getCurrentMonthKey();
    if (item.lastPaidMonth === currentMonth) return true;
    if (item.nextDue && item.nextDue.slice(0, 7) > currentMonth) return true;
    return false;
  }

  markRecurringPaid(id) {
    const item = this.recurring.find(r => String(r.id) === String(id));
    if (!item) return null;

    const todayStr = getTodayDateString();
    const currentMonth = getCurrentMonthKey();

    // Log the transaction automatically
    const category = this.categories.find(c => c.id === item.categoryId);
    this.addTransaction({
      type: 'expense',
      amount: item.amount,
      categoryId: item.categoryId,
      categoryName: category ? category.name : 'Bills',
      categoryEmoji: category ? category.emoji : '⚡',
      note: `Paid recurring: ${item.name} 🔁`,
      recurringId: item.id,
      date: todayStr,
    });

    // Advance next due date by 1 month safely
    const baseDue = item.nextDue || todayStr;
    const parts = baseDue.split('-');
    const curYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const curMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const curDay = parseInt(parts[2], 10) || item.dueDay || 1;

    // Advance month (+1 in 0-indexed month)
    const nextDate = new Date(curYear, curMonth, curDay);
    const nextYear = nextDate.getFullYear();
    const nextMon = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextDay = String(Math.min(curDay, new Date(nextYear, nextDate.getMonth() + 1, 0).getDate())).padStart(2, '0');
    const nextDue = `${nextYear}-${nextMon}-${nextDay}`;

    item.lastPaid = todayStr;
    item.lastPaidMonth = currentMonth;
    item.nextDue = nextDue;

    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.RECURRING, item.id), {
        lastPaid: todayStr,
        lastPaidMonth: currentMonth,
        nextDue: nextDue,
      }).catch(err => {
        console.warn('Firestore recurring update error:', err);
      });
    }

    return item;
  }

  unmarkRecurringPaid(id) {
    const item = this.recurring.find(r => String(r.id) === String(id));
    if (!item) return null;

    const baseDue = item.nextDue || getTodayDateString();
    const parts = baseDue.split('-');
    const curYear = parseInt(parts[0], 10) || new Date().getFullYear();
    const curMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const curDay = parseInt(parts[2], 10) || item.dueDay || 1;

    // Rollback month (-2 in 0-indexed month)
    const prevDate = new Date(curYear, curMonth - 2, curDay);
    const prevYear = prevDate.getFullYear();
    const prevMon = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevDay = String(Math.min(curDay, new Date(prevYear, prevDate.getMonth() + 1, 0).getDate())).padStart(2, '0');
    const prevDue = `${prevYear}-${prevMon}-${prevDay}`;

    item.lastPaid = null;
    item.lastPaidMonth = null;
    item.nextDue = prevDue;

    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.RECURRING, item.id), {
        lastPaid: null,
        lastPaidMonth: null,
        nextDue: prevDue,
      }).catch(err => {
        console.warn('Firestore unmark recurring error:', err);
      });
    }

    return item;
  }

  deleteRecurring(id) {
    this.recurring = this.recurring.filter(r => r.id !== id);
    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.notify();

    const db = getDb();
    if (db) {
      deleteDoc(doc(db, FS_COLLECTIONS.RECURRING, id)).catch(err => {
        console.warn('Firestore delete recurring error:', err);
      });
    }
  }

  // --- SAVINGS GOALS ---
  getGoals() {
    return [...this.goals];
  }

  addGoal(goal) {
    const newGoal = {
      id: goal.id || ('goal-' + Date.now()),
      name: goal.name.trim(),
      targetAmount: parseFloat(goal.targetAmount),
      currentAmount: parseFloat(goal.currentAmount || 0),
      emoji: goal.emoji || '🎯',
      deadline: goal.deadline || '',
      isCompleted: false,
    };
    this.goals.push(newGoal);
    this.save(STORAGE_KEYS.GOALS, this.goals);
    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.GOALS, newGoal.id), newGoal).catch(err => {
        console.warn('Firestore add goal error:', err);
      });
    }

    return newGoal;
  }

  contributeToGoal(id, addAmount) {
    const goal = this.goals.find(g => g.id === id);
    if (!goal) return null;

    const amount = parseFloat(addAmount);
    goal.currentAmount = Math.max(0, goal.currentAmount + amount);
    if (goal.currentAmount >= goal.targetAmount) {
      goal.isCompleted = true;
    } else {
      goal.isCompleted = false;
    }

    this.save(STORAGE_KEYS.GOALS, this.goals);
    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.GOALS, id), {
        currentAmount: goal.currentAmount,
        isCompleted: goal.isCompleted,
      }).catch(err => {
        console.warn('Firestore goal contribution error:', err);
      });
    }

    return goal;
  }

  deleteGoal(id) {
    this.goals = this.goals.filter(g => g.id !== id);
    this.save(STORAGE_KEYS.GOALS, this.goals);
    this.notify();

    const db = getDb();
    if (db) {
      deleteDoc(doc(db, FS_COLLECTIONS.GOALS, id)).catch(err => {
        console.warn('Firestore delete goal error:', err);
      });
    }
  }

  // --- SUMMARY COMPUTATIONS ---
  getMonthSummary(yearMonth = getCurrentMonthKey()) {
    const plan = this.getMonthPlan(yearMonth);
    const monthTx = this.transactions.filter(t => t.date && t.date.startsWith(yearMonth));

    let totalIncome = 0;
    let totalExpense = 0;

    monthTx.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    });

    const budgetLimit = plan.spendBudget;
    const remainingBudget = Math.max(0, budgetLimit - totalExpense);
    const usagePercent = budgetLimit > 0 ? (totalExpense / budgetLimit) * 100 : 0;

    return {
      yearMonth,
      plan,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      budgetLimit,
      remainingBudget,
      usagePercent,
      mood: usagePercent > 100 ? 'sad' : usagePercent >= 70 ? 'worried' : 'happy',
    };
  }

  getCategorySpending(yearMonth = getCurrentMonthKey()) {
    const monthExpenses = this.transactions.filter(
      t => t.type === 'expense' && t.date && t.date.startsWith(yearMonth)
    );

    const spendMap = {};
    monthExpenses.forEach(t => {
      const catId = t.categoryId || 'cat-general';
      if (!spendMap[catId]) {
        spendMap[catId] = {
          categoryId: catId,
          name: t.categoryName || 'General',
          emoji: t.categoryEmoji || '🏷️',
          total: 0,
        };
      }
      spendMap[catId].total += t.amount;
    });

    return this.categories
      .filter(c => c.monthly_limit > 0 || spendMap[c.id])
      .map(cat => {
        const spent = spendMap[cat.id] ? spendMap[cat.id].total : 0;
        const limit = cat.monthly_limit || 0;
        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        return {
          ...cat,
          spent,
          percent,
          remaining: Math.max(0, limit - spent),
          isExceeded: limit > 0 && spent > limit,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }

  // --- BACKUP & CSV EXPORT ---
  exportCSV() {
    const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Note'];
    const rows = this.transactions.map(t => [
      `"${t.id}"`,
      `"${t.date}"`,
      `"${t.type}"`,
      `"${t.categoryName || ''}"`,
      t.amount,
      `"${(t.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cloudy_budget_${getTodayDateString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportJSON() {
    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      categories: this.categories,
      transactions: this.transactions,
      recurring: this.recurring,
      goals: this.goals,
      cutoffs: this.cutoffs,
      settings: this.settings,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cloudy_budget_backup_${getTodayDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString) {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid JSON input');
      }

      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Import data must be a JSON object');
      }

      // Check if file contains at least one recognized key
      const hasRecognizedKey = ['transactions', 'categories', 'recurring', 'goals', 'cutoffs', 'settings'].some(k => k in data);
      if (!hasRecognizedKey) {
        throw new Error('File does not contain valid budget tracker data');
      }

      // Create an automatic recovery snapshot before replacing
      try {
        const safetyBackup = {
          backedUpAt: new Date().toISOString(),
          categories: this.categories,
          transactions: this.transactions,
          recurring: this.recurring,
          goals: this.goals,
          cutoffs: this.cutoffs,
          settings: this.settings,
        };
        localStorage.setItem('cloudy_pre_import_recovery_backup', JSON.stringify(safetyBackup));
      } catch (backupErr) {
        console.warn('Safety backup notice:', backupErr);
      }

      if (Array.isArray(data.categories)) {
        this.categories = this.sanitizeCategories(data.categories);
        this.save(STORAGE_KEYS.CATEGORIES, this.categories);
      }
      if (Array.isArray(data.transactions)) {
        this.transactions = data.transactions.filter(t => t && t.id && t.type);
        this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      }
      if (Array.isArray(data.recurring)) {
        this.recurring = data.recurring.filter(r => r && r.id);
        this.save(STORAGE_KEYS.RECURRING, this.recurring);
      }
      if (Array.isArray(data.goals)) {
        this.goals = data.goals.filter(g => g && g.id);
        this.save(STORAGE_KEYS.GOALS, this.goals);
      }
      if (data.cutoffs && typeof data.cutoffs === 'object') {
        this.cutoffs = data.cutoffs;
        this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
      }
      if (data.settings && typeof data.settings === 'object') {
        this.settings = { ...this.settings, ...data.settings };
        this.save(STORAGE_KEYS.SETTINGS, this.settings);
        this.applyTheme(this.settings.theme);
      }

      this.notify();

      if (isFirebaseConfigured()) {
        this.pushLocalDataToCloud().catch(err => console.warn('Cloud import sync error:', err));
      }
      return { success: true, count: this.transactions.length };
    } catch (e) {
      console.error('Import failed:', e);
      return { success: false, error: e.message || 'Invalid format' };
    }
  }

  async clearAllData() {
    this.transactions = [];
    this.recurring = [];
    this.goals = [];
    this.cutoffs = {};
    this.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    this.settings = { ...DEFAULT_SETTINGS };

    // Clear all localStorage keys completely
    try {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('lyka_transactions_v2');
      localStorage.removeItem('lyka_cutoffs_v2');
      localStorage.removeItem('lyka_recurring_v2');
      localStorage.removeItem('lyka_goals_v2');
      localStorage.removeItem('lyka_settings_v2');
      localStorage.removeItem('lyka_categories_v2');
    } catch (e) {
      console.warn('LocalStorage clear error:', e);
    }

    this.save(STORAGE_KEYS.TRANSACTIONS, []);
    this.save(STORAGE_KEYS.RECURRING, []);
    this.save(STORAGE_KEYS.GOALS, []);
    this.save(STORAGE_KEYS.CUTOFFS, {});
    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.save(STORAGE_KEYS.SETTINGS, this.settings);
    localStorage.setItem(STORAGE_KEYS.FIREBASE_INITIALIZED, 'true');

    this.applyTheme(this.settings.theme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lyka:reset-payday-dismissal'));
    }
    this.notify();

    const db = getDb();
    if (db) {
      try {
        const collections = [
          FS_COLLECTIONS.TRANSACTIONS,
          FS_COLLECTIONS.RECURRING,
          FS_COLLECTIONS.GOALS,
          FS_COLLECTIONS.CUTOFFS,
        ];
        for (const col of collections) {
          const snap = await getDocs(collection(db, col));
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
        const batch = writeBatch(db);
        this.categories.forEach(c => batch.set(doc(db, FS_COLLECTIONS.CATEGORIES, c.id), c));
        batch.set(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), {
          currency: this.settings.currency,
          monthlyBudget: this.settings.monthlyBudget,
          expectedIncome: this.settings.expectedIncome,
          savingsRate: this.settings.savingsRate,
          payCycle: this.settings.payCycle,
          paydays: this.settings.paydays,
          salaryByPayday: this.settings.salaryByPayday,
          soundEnabled: this.settings.soundEnabled,
        });
        await batch.commit();
      } catch (err) {
        console.warn('Clear all cloud data error:', err);
      }
    }
    this.notify();
    return true;
  }

  resetToDemoData() {
    return this.clearAllData();
  }
}

export const store = new BudgetStore();

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
import { getDb, isFirebaseConfigured } from './firebase.js';
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
  { id: 'cat-food', name: 'Food & Groceries', emoji: '🍱', color: '#FFD1DC', monthly_limit: 0 },
  { id: 'cat-coffee', name: 'Coffee & Treats', emoji: '🧋', color: '#FFE5B4', monthly_limit: 0 },
  { id: 'cat-transit', name: 'Transportation', emoji: '🚌', color: '#BFE3F7', monthly_limit: 0 },
  { id: 'cat-bills', name: 'Bills & Utilities', emoji: '⚡', color: '#C8E6C9', monthly_limit: 0 },
  { id: 'cat-shop', name: 'Shopping & Needs', emoji: '🛍️', color: '#E1BEE7', monthly_limit: 0 },
  { id: 'cat-care', name: 'Self-Care & Health', emoji: '🌸', color: '#FFCDD2', monthly_limit: 0 },
  { id: 'cat-fun', name: 'Fun & Hobbies', emoji: '🎮', color: '#FFF9C4', monthly_limit: 0 },
  { id: 'cat-income', name: 'Salary & Income', emoji: '💼', color: '#B2DFDB', monthly_limit: 0 },
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

class BudgetStore {
  constructor() {
    this.listeners = new Set();
    this.unsubscribers = [];
    this.isCloudSyncActive = false;

    // Load initial fast state from localStorage (clean empty state for transactions)
    this.categories = this.load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
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
    this.listeners.forEach(fn => {
      try {
        fn(this);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    });
  }

  // --- FIREBASE REALTIME SETUP ---
  initFirebase() {
    if (!isFirebaseConfigured()) {
      this.isCloudSyncActive = false;
      return;
    }

    const db = getDb();
    if (!db) return;

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
          this.categories = remoteCats;
          this.save(STORAGE_KEYS.CATEGORIES, this.categories);
          this.notify();
        } else {
          // If Firestore is empty, seed it with current categories
          this.seedInitialData(db);
        }
      }, (err) => console.warn('Categories sync error:', err));
      this.unsubscribers.push(unsubCat);

      // 2. Transactions Realtime Listener
      const unsubTx = onSnapshot(collection(db, FS_COLLECTIONS.TRANSACTIONS), (snapshot) => {
        const remoteTx = [];
        snapshot.forEach(docSnap => remoteTx.push(docSnap.data()));
        // Sort newest first
        remoteTx.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        this.transactions = remoteTx;
        this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
        this.notify();
      }, (err) => console.warn('Transactions sync error:', err));
      this.unsubscribers.push(unsubTx);

      // 3. Recurring Realtime Listener
      const unsubRec = onSnapshot(collection(db, FS_COLLECTIONS.RECURRING), (snapshot) => {
        const remoteRec = [];
        snapshot.forEach(docSnap => remoteRec.push(docSnap.data()));
        this.recurring = remoteRec;
        this.save(STORAGE_KEYS.RECURRING, this.recurring);
        this.notify();
      }, (err) => console.warn('Recurring sync error:', err));
      this.unsubscribers.push(unsubRec);

      // 4. Goals Realtime Listener
      const unsubGoals = onSnapshot(collection(db, FS_COLLECTIONS.GOALS), (snapshot) => {
        const remoteGoals = [];
        snapshot.forEach(docSnap => remoteGoals.push(docSnap.data()));
        this.goals = remoteGoals;
        this.save(STORAGE_KEYS.GOALS, this.goals);
        this.notify();
      }, (err) => console.warn('Goals sync error:', err));
      this.unsubscribers.push(unsubGoals);

      // 5. Cutoffs Realtime Listener
      const unsubCutoffs = onSnapshot(collection(db, FS_COLLECTIONS.CUTOFFS), (snapshot) => {
        const remoteCutoffs = {};
        snapshot.forEach(docSnap => {
          remoteCutoffs[docSnap.id] = docSnap.data();
        });
        this.cutoffs = remoteCutoffs;
        this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
        this.notify();
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
    const category = this.categories.find(c => c.id === tx.categoryId);
    const isIncome = tx.type === 'income' || tx.categoryId === 'cat-income' || (category && category.name.toLowerCase().includes('income'));
    const newTx = {
      id: tx.id || ('tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      type: isIncome ? 'income' : 'expense',
      amount: parseFloat(tx.amount) || 0,
      categoryId: tx.categoryId,
      categoryName: category ? category.name : (tx.categoryName || (isIncome ? 'Salary & Income' : 'General')),
      categoryEmoji: category ? category.emoji : (tx.categoryEmoji || ''),
      note: tx.note ? tx.note.trim() : '',
      date: tx.date || getTodayDateString(),
      recurringId: tx.recurringId || null,
      createdAt: tx.createdAt || new Date().toISOString(),
    };

    // Calculate cutoff that this transaction belongs to
    const txDate = new Date(newTx.date + (newTx.date.includes('T') ? '' : 'T00:00:00'));
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

    this.transactions[idx] = {
      ...this.transactions[idx],
      ...updates,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : this.transactions[idx].amount,
      categoryName: category ? category.name : (updates.categoryName || this.transactions[idx].categoryName),
      categoryEmoji: category ? category.emoji : (updates.categoryEmoji || this.transactions[idx].categoryEmoji),
    };

    const updated = this.transactions[idx];
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
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
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
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
    return getCutoffForDate(date, this.settings.paydays || [10, 25]);
  }

  getCutoffRecord(id) {
    return (this.cutoffs && this.cutoffs[id]) || null;
  }

  saveCutoffRecord(record) {
    if (!this.cutoffs) this.cutoffs = {};
    this.cutoffs[record.id] = record;
    this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
    this.notify();

    const db = getDb();
    if (db) {
      setDoc(doc(db, FS_COLLECTIONS.CUTOFFS, record.id), record).catch(err => {
        console.warn('Firestore cutoff update error:', err);
      });
    }
    return record;
  }

  getCutoffSummary(cutoff = this.getCurrentCutoff()) {
    const plan = this.getCutoffPlan(cutoff);
    const periodTx = this.transactions.filter(
      t => t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );

    let totalIncome = 0;
    let totalExpense = 0;
    let billsTotal = 0;

    periodTx.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
        const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
        if (isBill) {
          billsTotal += amt;
        }
      }
    });

    const budgetLimit = plan.spendBudget;
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
      dailyExpense: Math.max(0, totalExpense - billsTotal),
      carriedIn: plan.carriedIn,
      baseBudget: plan.paycheck - plan.savingsTarget,
      budgetLimit,
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
    const periodExpenses = this.transactions.filter(
      t => t.type === 'expense' && t.date && isDateInRange(t.date, cutoff.start, cutoff.end)
    );

    const spendMap = {};
    periodExpenses.forEach(t => {
      const catId = t.categoryId || 'cat-general';
      if (!spendMap[catId]) {
        spendMap[catId] = {
          categoryId: catId,
          name: t.categoryName || 'General',
          emoji: t.categoryEmoji || '🏷️',
          total: 0,
          billsTotal: 0,
        };
      }
      spendMap[catId].total += t.amount;
      const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
      if (isBill) {
        spendMap[catId].billsTotal += t.amount;
      }
    });

    const nominalSum = this.categories.reduce((acc, c) => acc + ((c.monthly_limit || 0) / 2), 0);

    return this.categories
      .filter(c => c.monthly_limit > 0 || spendMap[c.id])
      .map(cat => {
        const spent = spendMap[cat.id] ? spendMap[cat.id].total : 0;
        const billsSpent = spendMap[cat.id] ? spendMap[cat.id].billsTotal : 0;
        const monthlyLimit = cat.monthly_limit || 0;
        const nominalHalf = isSemi ? Math.round(monthlyLimit / 2) : monthlyLimit;

        // Specific cutoff limit takes precedence if set, otherwise scale proportionally
        let limit = nominalHalf;
        if (plan.record && plan.record.categoryLimits && plan.record.categoryLimits[cat.id] !== undefined) {
          limit = parseFloat(plan.record.categoryLimits[cat.id]) || 0;
        } else if (isSemi && nominalSum > 0 && monthlyLimit > 0) {
          const ratio = (monthlyLimit / 2) / nominalSum;
          limit = Math.round(plan.spendBudget * ratio);
        } else if (!isSemi && this.settings.monthlyBudget > 0 && monthlyLimit > 0) {
          const ratio = monthlyLimit / (this.settings.monthlyBudget || 1);
          limit = Math.round(plan.spendBudget * ratio);
        }

        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        return {
          ...cat,
          monthly_limit: monthlyLimit,
          period_limit: limit,
          spent,
          billsSpent,
          dailySpent: Math.max(0, spent - billsSpent),
          percent,
          remaining: Math.max(0, limit - spent),
          isExceeded: limit > 0 && spent > limit,
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
      'cat-food': Math.round(needs * 0.50),
      'cat-bills': Math.round(needs * 0.30),
      'cat-transit': Math.round(needs * 0.20),
      'cat-shop': Math.round(wants * 0.40),
      'cat-coffee': Math.round(wants * 0.25),
      'cat-fun': Math.round(wants * 0.20),
      'cat-care': Math.round(wants * 0.15),
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

    this.notify();
  }

  getPendingPayday() {
    if ((this.settings.payCycle || 'semi-monthly') !== 'semi-monthly') return null;
    const curCutoff = this.getCurrentCutoff();
    const record = this.getCutoffRecord(curCutoff.id);
    const plan = this.getCutoffPlan(curCutoff);
    const hasLoggedIncome = plan.loggedIncome > 0;

    const todayDate = new Date();
    const dayNum = todayDate.getDate();
    const paydays = this.settings.paydays || [10, 25];
    const isPayday = paydays.includes(dayNum);

    // If income has already been logged (>0) and confirmed with a positive salary:
    const isSalaryConfirmed = Boolean(
      record &&
      record.salaryConfirmed &&
      (parseFloat(record.salaryAmount) > 0 || hasLoggedIncome)
    );

    // 1. When income is 0 / not logged yet (!hasLoggedIncome), the paycheck modal
    // MUST appear so the user can log their cutoff income (even when cleared).
    // 2. When today is payday (10 or 25), the modal MUST appear.
    // 3. Only hide modal if today is NOT payday AND income has already been logged and confirmed.
    if (!isPayday && hasLoggedIncome && isSalaryConfirmed) {
      return null;
    }

    // If today is payday and user already confirmed TODAY's payday:
    if (isPayday && isSalaryConfirmed && record && record.confirmedAt) {
      const confirmedDate = record.confirmedAt.slice(0, 10);
      const todayStr = getTodayDateString();
      if (confirmedDate === todayStr) {
        return null;
      }
    }

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
      isPayday,
      hasLoggedIncome,
      previous: {
        cutoff: prevCutoff,
        leftover,
      },
    };
  }

  confirmPayday({ amount, leftoverAction = 'save', goalId, note } = {}) {
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

    // 2. Handle leftover from previous cutoff (defaults to 'save' so remaining money goes to savings)
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

    if (leftoverAmount > 0) {
      if (action === 'save') {
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

    const record = {
      id: curCutoff.id,
      salaryConfirmed: true,
      salaryTxId: tx ? tx.id : null,
      salaryAmount: amountVal,
      carriedIn,
      leftoverAction: action,
      leftoverAmount,
      leftoverGoalId: targetGoalId,
      confirmedAt: new Date().toISOString(),
    };

    this.saveCutoffRecord(record);
    return record;
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
          spent: 0, // non-bill
          billsSpent: 0,
          txs: [],
        };
      }
      map[d].totalSpent += t.amount;
      const isBill = !!t.recurringId || t.categoryId === 'cat-bills' || (t.note && t.note.startsWith('Paid recurring:'));
      if (isBill) {
        map[d].billsSpent += t.amount;
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
    const dayData = spendingMap[dateStr] || { totalSpent: 0, spent: 0, billsSpent: 0, txs: [] };
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
      totalSpent: dayData.totalSpent,
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
    this.updateCategoryLimit('cat-food', Math.round(needs * 0.50));
    this.updateCategoryLimit('cat-bills', Math.round(needs * 0.30));
    this.updateCategoryLimit('cat-transit', Math.round(needs * 0.20));

    this.updateCategoryLimit('cat-shop', Math.round(wants * 0.40));
    this.updateCategoryLimit('cat-coffee', Math.round(wants * 0.25));
    this.updateCategoryLimit('cat-fun', Math.round(wants * 0.20));
    this.updateCategoryLimit('cat-care', Math.round(wants * 0.15));

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
      const data = JSON.parse(jsonString);
      if (data.categories) this.categories = data.categories;
      if (data.transactions) this.transactions = data.transactions;
      if (data.recurring) this.recurring = data.recurring;
      if (data.goals) this.goals = data.goals;
      if (data.cutoffs) this.cutoffs = data.cutoffs;
      if (data.settings) this.settings = data.settings;

      this.save(STORAGE_KEYS.CATEGORIES, this.categories);
      this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      this.save(STORAGE_KEYS.RECURRING, this.recurring);
      this.save(STORAGE_KEYS.GOALS, this.goals);
      this.save(STORAGE_KEYS.CUTOFFS, this.cutoffs);
      this.save(STORAGE_KEYS.SETTINGS, this.settings);

      this.applyTheme(this.settings.theme);
      this.notify();

      if (isFirebaseConfigured()) {
        this.pushLocalDataToCloud().catch(err => console.warn('Cloud import sync error:', err));
      }
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
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

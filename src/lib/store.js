// ====================================================================
// CLOUDY BUDGET - CENTRAL REACTIVE STORE
// Reliable local storage by default + Cloud Firestore Realtime Sync
// Designed for seamless multi-device live updates with zero-login
// ====================================================================

import { getTodayDateString, getCurrentMonthKey } from './format.js';
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
  FIREBASE_INITIALIZED: 'cloudy_fb_seeded_v1',
};

const FS_COLLECTIONS = {
  CATEGORIES: 'cloudy_categories',
  TRANSACTIONS: 'cloudy_transactions',
  RECURRING: 'cloudy_recurring',
  GOALS: 'cloudy_goals',
  SETTINGS: 'cloudy_settings',
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: 'Food & Groceries', emoji: '🍱', color: '#FFD1DC', monthly_limit: 8000 },
  { id: 'cat-coffee', name: 'Coffee & Treats', emoji: '🧋', color: '#FFE5B4', monthly_limit: 2500 },
  { id: 'cat-transit', name: 'Transportation', emoji: '🚌', color: '#BFE3F7', monthly_limit: 3000 },
  { id: 'cat-bills', name: 'Bills & Utilities', emoji: '⚡', color: '#C8E6C9', monthly_limit: 6000 },
  { id: 'cat-shop', name: 'Shopping & Needs', emoji: '🛍️', color: '#E1BEE7', monthly_limit: 3500 },
  { id: 'cat-care', name: 'Self-Care & Health', emoji: '🌸', color: '#FFCDD2', monthly_limit: 2000 },
  { id: 'cat-fun', name: 'Fun & Hobbies', emoji: '🎮', color: '#FFF9C4', monthly_limit: 2000 },
  { id: 'cat-income', name: 'Salary & Income', emoji: '💼', color: '#B2DFDB', monthly_limit: 0 },
];

const DEFAULT_SETTINGS = {
  currency: '₱',
  monthlyBudget: 25000,
  expectedIncome: 35000,
  theme: 'day', // 'day' | 'night'
  soundEnabled: true,
};

function getSampleTransactions() {
  const today = getTodayDateString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'tx-1',
      type: 'income',
      amount: 35000,
      categoryId: 'cat-income',
      categoryName: 'Salary & Income',
      categoryEmoji: '💼',
      note: 'Monthly Salary ☁️',
      date: threeDaysAgo,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 1450,
      categoryId: 'cat-food',
      categoryName: 'Food & Groceries',
      categoryEmoji: '🍱',
      note: 'Weekly Grocery haul',
      date: yesterday,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'tx-3',
      type: 'expense',
      amount: 185,
      categoryId: 'cat-coffee',
      categoryName: 'Coffee & Treats',
      categoryEmoji: '🧋',
      note: 'Iced Matcha Oat Latte',
      date: today,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 160,
      categoryId: 'cat-transit',
      categoryName: 'Transportation',
      categoryEmoji: '🚌',
      note: 'Commute reload',
      date: today,
      createdAt: new Date().toISOString(),
    },
  ];
}

const DEFAULT_RECURRING = [
  {
    id: 'rec-1',
    name: 'Home Fiber Internet',
    amount: 1699,
    categoryId: 'cat-bills',
    frequency: 'monthly',
    dueDay: 15,
    nextDue: getTodayDateString().slice(0, 8) + '15',
    isActive: true,
  },
  {
    id: 'rec-2',
    name: 'Music & Cloud Storage',
    amount: 249,
    categoryId: 'cat-fun',
    frequency: 'monthly',
    dueDay: 20,
    nextDue: getTodayDateString().slice(0, 8) + '20',
    isActive: true,
  },
];

const DEFAULT_GOALS = [
  {
    id: 'goal-1',
    name: 'Tokyo Dream Vacation 🌸',
    targetAmount: 50000,
    currentAmount: 24500,
    emoji: '✈️',
    deadline: '2026-12-25',
    isCompleted: false,
  },
  {
    id: 'goal-2',
    name: 'Fluffy Emergency Fund 🛡️',
    targetAmount: 30000,
    currentAmount: 18000,
    emoji: '☁️',
    deadline: '2026-11-30',
    isCompleted: false,
  },
];

class BudgetStore {
  constructor() {
    this.listeners = new Set();
    this.unsubscribers = [];
    this.isCloudSyncActive = false;

    // Load initial fast state from localStorage
    this.categories = this.load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    this.transactions = this.load(STORAGE_KEYS.TRANSACTIONS, getSampleTransactions());
    this.recurring = this.load(STORAGE_KEYS.RECURRING, DEFAULT_RECURRING);
    this.goals = this.load(STORAGE_KEYS.GOALS, DEFAULT_GOALS);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

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

      // 5. Settings Realtime Listener
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

  // Seed default collections if fresh database
  async seedInitialData(db) {
    try {
      const seeded = localStorage.getItem(STORAGE_KEYS.FIREBASE_INITIALIZED);
      if (seeded) return;

      const batch = writeBatch(db);
      this.categories.forEach(c => {
        batch.set(doc(db, FS_COLLECTIONS.CATEGORIES, c.id), c);
      });
      this.transactions.forEach(t => {
        batch.set(doc(db, FS_COLLECTIONS.TRANSACTIONS, t.id), t);
      });
      this.recurring.forEach(r => {
        batch.set(doc(db, FS_COLLECTIONS.RECURRING, r.id), r);
      });
      this.goals.forEach(g => {
        batch.set(doc(db, FS_COLLECTIONS.GOALS, g.id), g);
      });
      batch.set(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), {
        currency: this.settings.currency,
        monthlyBudget: this.settings.monthlyBudget,
        expectedIncome: this.settings.expectedIncome,
        soundEnabled: this.settings.soundEnabled,
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
    batch.set(doc(db, FS_COLLECTIONS.SETTINGS, 'global'), {
      currency: this.settings.currency,
      monthlyBudget: this.settings.monthlyBudget,
      expectedIncome: this.settings.expectedIncome,
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
    const newTx = {
      id: tx.id || ('tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
      type: tx.type || 'expense',
      amount: parseFloat(tx.amount),
      categoryId: tx.categoryId,
      categoryName: category ? category.name : (tx.categoryName || 'General'),
      categoryEmoji: category ? category.emoji : (tx.categoryEmoji || '🏷️'),
      note: tx.note ? tx.note.trim() : '',
      date: tx.date || getTodayDateString(),
      createdAt: tx.createdAt || new Date().toISOString(),
    };

    this.transactions.unshift(newTx);
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
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

  // --- BUDGET PLANNER HELPERS ---
  getDailyAllowance() {
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
    };
  }

  apply503020Rule(incomeVal) {
    const income = parseFloat(incomeVal) || (this.settings.expectedIncome || 35000);
    const plannedBudget = Math.round(income * 0.8); // 80% total spending cap (50% needs + 30% wants)

    this.updateSettings({
      expectedIncome: income,
      monthlyBudget: plannedBudget,
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

  markRecurringPaid(id) {
    const item = this.recurring.find(r => r.id === id);
    if (!item) return null;

    // Log the transaction automatically
    const category = this.categories.find(c => c.id === item.categoryId);
    this.addTransaction({
      type: 'expense',
      amount: item.amount,
      categoryId: item.categoryId,
      categoryName: category ? category.name : 'Bills',
      categoryEmoji: category ? category.emoji : '⚡',
      note: `Paid recurring: ${item.name} 🔁`,
      date: getTodayDateString(),
    });

    // Advance next due date by 1 month
    const currentDate = new Date(item.nextDue || getTodayDateString());
    currentDate.setMonth(currentDate.getMonth() + 1);
    item.nextDue = currentDate.toISOString().split('T')[0];

    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.notify();

    const db = getDb();
    if (db) {
      updateDoc(doc(db, FS_COLLECTIONS.RECURRING, id), { nextDue: item.nextDue }).catch(err => {
        console.warn('Firestore recurring update error:', err);
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

    const budgetLimit = this.settings.monthlyBudget || 25000;
    const remainingBudget = Math.max(0, budgetLimit - totalExpense);
    const usagePercent = budgetLimit > 0 ? (totalExpense / budgetLimit) * 100 : 0;

    return {
      yearMonth,
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
      if (data.settings) this.settings = data.settings;

      this.save(STORAGE_KEYS.CATEGORIES, this.categories);
      this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      this.save(STORAGE_KEYS.RECURRING, this.recurring);
      this.save(STORAGE_KEYS.GOALS, this.goals);
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

  resetToDemoData() {
    this.categories = DEFAULT_CATEGORIES;
    this.transactions = getSampleTransactions();
    this.recurring = DEFAULT_RECURRING;
    this.goals = DEFAULT_GOALS;
    this.settings = DEFAULT_SETTINGS;

    this.save(STORAGE_KEYS.CATEGORIES, this.categories);
    this.save(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    this.save(STORAGE_KEYS.RECURRING, this.recurring);
    this.save(STORAGE_KEYS.GOALS, this.goals);
    this.save(STORAGE_KEYS.SETTINGS, this.settings);

    this.applyTheme(this.settings.theme);
    this.notify();

    if (isFirebaseConfigured()) {
      this.pushLocalDataToCloud().catch(err => console.warn('Demo reset cloud sync error:', err));
    }
  }
}

export const store = new BudgetStore();

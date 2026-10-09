// ====================================================================
// LYKA WALLET - FIREBASE CLIENT & CONFIGURATION
// Realtime cloud sync with IndexedDB offline persistence
// Supports secure Vite environment variables with built-in client fallback
// ====================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const STORAGE_KEY = 'cloudy_firebase_config_v1';

// Clear any legacy credentials stored in localStorage for safety
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
} catch (_) {}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBqUFBGZZPjuNLWbQ2ruDv8fjBNnFL-flk",
  authDomain: "lykabudget.firebaseapp.com",
  projectId: "lykabudget",
  storageBucket: "lykabudget.firebasestorage.app",
  messagingSenderId: "2166696729",
  appId: "1:2166696729:web:3c8f66491c639300a83388",
};

export function getFirebaseConfig() {
  // Read from Vite environment variables (from .env or hosting secrets) with default client fallback
  const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
  const envConfig = {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY,
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: metaEnv.VITE_FIREBASE_APP_ID,
  };

  if (envConfig.projectId && envConfig.apiKey) {
    return envConfig;
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function isFirebaseConfigured() {
  if (typeof window === 'undefined') return false; // Offline mode for fast Node test runner
  const config = getFirebaseConfig();
  return Boolean(config && config.projectId && config.apiKey);
}

let firestoreInstance = null;
let firebaseAppInstance = null;
let authInstance = null;

export function getFirebaseApp() {
  if (typeof window === 'undefined') return null;
  if (firebaseAppInstance) return firebaseAppInstance;

  const config = getFirebaseConfig();
  if (!config) return null;

  if (getApps().length > 0) {
    firebaseAppInstance = getApp();
  } else {
    firebaseAppInstance = initializeApp(config);
  }
  return firebaseAppInstance;
}

export function getFirebaseAuth() {
  if (typeof window === 'undefined') return null;
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}

export async function ensureAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (_) {
    // If Anonymous Auth is not enabled in Firebase Console, continue gracefully
    return null;
  }
}

export function getDb() {
  if (typeof window === 'undefined') return null;
  if (firestoreInstance) return firestoreInstance;

  const app = getFirebaseApp();
  if (!app) return null;

  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    // If persistence already initialized or unsupported, fallback to standard getFirestore
    try {
      firestoreInstance = getFirestore(app);
    } catch (e) {
      console.warn('Firestore initialization fallback:', e);
    }
  }

  // Eagerly attempt auth if available without blocking
  ensureAuth().catch(() => {});

  return firestoreInstance;
}

// --- SYNC STATUS TRACKER ---
let currentSyncStatus = 'offline'; // 'offline' | 'synced' | 'syncing' | 'error'
const syncListeners = new Set();

export function getSyncStatus() {
  return currentSyncStatus;
}

export function setSyncStatus(status) {
  if (currentSyncStatus === status) return;
  currentSyncStatus = status;
  syncListeners.forEach(fn => {
    try { fn(currentSyncStatus); } catch (_) {}
  });
}

export function onSyncStatusChange(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

export function getSyncBadgeHtml(status = currentSyncStatus) {
  if (status === 'synced') {
    return `<span class="pill" style="background: rgba(86, 193, 144, 0.15); color: var(--mint-deep); font-size: 0.76rem; font-weight: 700; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid rgba(86, 193, 144, 0.4);" title="Live Cloud Sync Active"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--mint-deep);"></span>Synced</span>`;
  }
  if (status === 'syncing') {
    return `<span class="pill" style="background: rgba(255, 210, 157, 0.25); color: #C67A10; font-size: 0.76rem; font-weight: 700; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid #FFE58F;" title="Syncing with Firebase..."><span style="width: 7px; height: 7px; border-radius: 50%; background: #C67A10;"></span>Syncing</span>`;
  }
  if (status === 'error') {
    return `<span class="pill" style="background: rgba(255, 123, 137, 0.2); color: var(--danger); font-size: 0.76rem; font-weight: 700; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid var(--coral-alert);" title="Cloud Sync Warning"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--danger);"></span>Sync alert</span>`;
  }
  return `<span class="pill" style="background: var(--sky-100); color: var(--text-muted); font-size: 0.76rem; font-weight: 700; padding: 0.25rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid var(--border-color);" title="Local Storage Mode"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted);"></span>Local Mode</span>`;
}

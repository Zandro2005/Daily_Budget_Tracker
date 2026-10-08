// ====================================================================
// CLOUDY BUDGET - FIREBASE CLIENT & CONFIGURATION
// Supports env vars (VITE_FIREBASE_*) & Settings override
// Offline persistence enabled via IndexedDB multi-tab cache
// Firebase Anonymous Auth for zero-login security
// ====================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const STORAGE_KEY = 'cloudy_firebase_config_v1';

// Clear any legacy credentials stored in localStorage for safety
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
} catch (_) {}

export function getFirebaseConfig() {
  // Read exclusively from secure Vite environment variables (from .env or hosting secrets)
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

  return null;
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(config && config.projectId && config.apiKey);
}

let firestoreInstance = null;
let firebaseAppInstance = null;
let authInstance = null;

export function getFirebaseApp() {
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
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}

export async function ensureAuth() {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('Anonymous auth notice:', err);
    return null;
  }
}

export function getDb() {
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

  // Eagerly trigger anonymous sign-in so requests are authorized
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


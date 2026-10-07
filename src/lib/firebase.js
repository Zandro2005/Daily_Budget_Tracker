// ====================================================================
// CLOUDY BUDGET - FIREBASE CLIENT & CONFIGURATION
// Supports env vars (VITE_FIREBASE_*) & Settings override
// Offline persistence enabled via IndexedDB multi-tab cache
// ====================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';

const STORAGE_KEY = 'cloudy_firebase_config_v1';

export function getFirebaseConfig() {
  // 1. Check local storage override (can be set in Settings UI)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored Firebase config:', e);
  }

  // 2. Check Vite environment variables (from .env or build secrets)
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
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

export function saveFirebaseConfig(config) {
  if (!config) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

let firestoreInstance = null;
let firebaseAppInstance = null;

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

  return firestoreInstance;
}

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, v] = line.trim().split('=');
  if (k && v) env[k] = v;
});

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(config);
const db = getFirestore(app);

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

async function resetCloud() {
  console.log('Clearing transactions, cutoffs, recurring, goals in Firestore...');
  const collections = ['cloudy_transactions', 'cloudy_cutoffs', 'cloudy_recurring', 'cloudy_goals'];
  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    for (const d of snap.docs) {
      console.log(`Deleting ${c}/${d.id}`);
      await deleteDoc(d.ref);
    }
  }

  console.log('Writing zero-based settings to cloudy_settings/global...');
  await setDoc(doc(db, 'cloudy_settings', 'global'), {
    currency: '₱',
    monthlyBudget: 0,
    expectedIncome: 0,
    savingsRate: 0.20,
    payCycle: 'semi-monthly',
    paydays: [10, 25],
    salaryByPayday: { 10: 0, 25: 0 },
    soundEnabled: true,
  });

  console.log('Writing zero monthly limits to cloudy_categories...');
  const catBatch = writeBatch(db);
  DEFAULT_CATEGORIES.forEach(cat => {
    catBatch.set(doc(db, 'cloudy_categories', cat.id), cat);
  });
  await catBatch.commit();

  console.log('Cloud reset complete! ☁️ All values zeroed out.');
  process.exit(0);
}

resetCloud().catch(err => {
  console.error(err);
  process.exit(1);
});

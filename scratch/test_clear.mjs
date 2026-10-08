import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';
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

async function testClear() {
  const collections = ['cloudy_transactions', 'cloudy_cutoffs', 'cloudy_recurring', 'cloudy_goals'];
  for (const c of collections) {
    const snap = await getDocs(collection(db, c));
    console.log(`Clearing ${c}: ${snap.size} docs`);
    for (const d of snap.docs) {
      console.log(`Deleting ${d.id}...`);
      await deleteDoc(d.ref);
    }
  }
  console.log('Done!');
  process.exit(0);
}

testClear().catch(err => {
  console.error('Error during testClear:', err);
  process.exit(1);
});

# ☁️ Cloudy Budget — Joyful Cinnamoroll Expense Tracker

A cheerful, interactive Cinnamoroll-inspired budget tracker crafted for Lyka. Designed for quick 3-tap logging, crystal-clear monthly overview at a glance, and joyful micro-interactions with **realtime multi-device cloud sync** powered by Firebase.

---

## ✨ Features

- **📱 Streamlined Mobile & Desktop Experience**: Focused 4-tab bottom navigation bar (`Home`, `Planner`, `History`, `Settings`) with an elevated center `+` Quick Add button and native safe-area-inset padding.
- **🔥 Realtime Multi-Device Sync (Firebase Cloud Firestore)**:
  - **Zero-Login Simplicity**: Open the app on your phone, laptop, or tablet—any expense you add appears on all devices instantly in real-time!
  - **100% Offline-Resilient**: Keep adding expenses without internet; changes sync automatically when back online via Firestore's multi-tab IndexedDB cache.
- **🗓️ Dedicated Budget Planner**: 
  - **Daily Safe Spending Allowance**: Real-time calculation (`₱X / day`) based on days remaining so you know exactly how much you can safely spend today.
  - **1-Tap 50/30/20 Smart Rule**: Instantly balances 50% Needs, 30% Wants, and 20% Savings.
  - **Category Envelopes**: Clear planned vs. actual spent progress meters with quick limit adjustments.
- **🐾 Interactive Cloud Puppy Mascot**: Dynamic mood changes based on budget usage (😊 *Happy* < 70%, 😳 *Worried* 70–100%, 😢 *Sad* over budget, 🎉 *Celebrating* on goal completion). Tap the mascot anytime for cute speech bubbles and gentle puppy chirps!
- **⚡ 3-Tap Quick Add Modal**: Instant expense & income logging with quick amount presets (+50, +100, +500, +1,000), visual category chips, and note input.
- **📋 Clean Activity Ledger**: Search, filter, delete with instant Undo toast, and CSV export.
- **🔊 Joyful Synthesizer SFX**: Native Web Audio sound effects (bubble pops, coin chimes, fanfare) that work 100% offline without external assets.
- **🌙 Day & Night Sky Modes**: Soft sky blue day theme and dreamy lavender twilight night mode.
- **📦 Data Backup & Restore**: Export complete JSON backups and CSV sheets anytime with 1-click restore.

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase (Optional for local testing)**:
   Copy `.env.example` to `.env` and fill in your Firebase project values:
   ```bash
   cp .env.example .env
   ```
   *(Or simply run the app and paste your Firebase keys directly in the Settings tab!)*

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Firebase Hosting

Deploy your app with one single command:

```bash
npm run deploy
```

Your live web app will be available worldwide at:
`https://<your-project-id>.web.app`

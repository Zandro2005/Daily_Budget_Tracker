# ☁️ Cloudy Budget — Joyful Cinnamoroll Expense Tracker

A cheerful, interactive Cinnamoroll-inspired budget tracker crafted for busy adults. Designed for quick 3-tap logging, crystal-clear monthly overview at a glance, and joyful micro-interactions.

---

## ✨ Features

- **📱 Streamlined Mobile Experience (iPhone & Android)**: Focused 4-tab bottom navigation bar (`Home`, `Planner`, `History`, `Settings`) with an elevated center `+` Quick Add button and native safe-area-inset padding.
- **🗓️ Dedicated Budget Planner**: 
  - **Daily Safe Spending Allowance**: Real-time calculation (`₱X / day`) based on days remaining so busy adults know exactly how much they can safely spend today.
  - **1-Tap 50/30/20 Smart Rule**: Instantly balances 50% Needs, 30% Wants, and 20% Savings.
  - **Category Envelopes**: Clear planned vs. actual spent progress meters with quick limit adjustments.
- **🐾 Interactive Cloud Puppy Mascot**: Dynamic mood changes based on budget usage (😊 *Happy* < 70%, 😳 *Worried* 70–100%, 😢 *Sad* over budget, 🎉 *Celebrating* on goal completion). Tap the mascot anytime for cute speech bubbles and gentle puppy chirps!
- **⚡ 3-Tap Quick Add Modal**: Instant expense & income logging with quick amount presets (+50, +100, +500, +1,000), visual category chips, and note input.
- **📋 Clean Activity Ledger**: Search, filter, delete with instant Undo toast, and CSV export.
- **🔊 Joyful Synthesizer SFX**: Native Web Audio sound effects (bubble pops, coin chimes, fanfare) that work 100% offline without external assets.
- **🌙 Day & Night Sky Modes**: Soft sky blue day theme and dreamy lavender twilight night mode.
- **💾 Dual Database Support**:
  - **Zero-config Local Mode (Active by default)**: All data is instantly saved in your browser localStorage.
  - **Supabase Cloud Sync**: Link your free Supabase database in Settings for seamless multi-device sync across your phone and PC.

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Netlify (Free & Easy)

1. Push this project to your GitHub repository.
2. Go to [Netlify](https://app.netlify.com) and click **"Add new site"** &rarr; **"Import an existing project"**.
3. Select your GitHub repository.
4. Netlify will automatically detect the settings from [`netlify.toml`](./netlify.toml):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **"Deploy site"**! Your site is live in seconds.

---

## 🗄️ Optional: Connecting Supabase (Cloud Sync)

If you'd like your budget to sync across your phone and laptop:

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project.
3. In the Supabase dashboard, go to the **SQL Editor**, open [`supabase/schema.sql`](./supabase/schema.sql), paste it, and click **Run**.
4. Copy your **Project URL** and **Anon Key** from *Project Settings &rarr; API*.
5. In your Cloudy Budget app, go to **Settings (⚙️)**, paste your keys in the **Supabase Cloud Sync** box, and click **Save Cloud Keys**!

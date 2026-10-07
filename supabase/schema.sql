-- ====================================================================
-- CLOUDY BUDGET - SUPABASE DATABASE SCHEMA
-- Run this in the Supabase SQL Editor (https://app.supabase.com)
-- ====================================================================

-- 1. Create tables
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  emoji text not null default '🏷️',
  color text not null default '#BFE3F7',
  monthly_limit numeric(12, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('expense', 'income')) not null default 'expense',
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  category_name text,
  category_emoji text,
  note text,
  date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  frequency text check (frequency in ('monthly', 'weekly', 'yearly')) default 'monthly',
  due_day integer check (due_day between 1 and 31),
  next_due date not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0,
  emoji text not null default '🎯',
  deadline date,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text default '₱',
  monthly_budget numeric(12, 2) default 25000,
  theme text default 'cloud-light',
  sound_enabled boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.savings_goals enable row level security;
alter table public.user_settings enable row level security;

-- 3. RLS Policies (Users can only read & write their own records)
create policy "Users can view own categories" on public.categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on public.categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on public.categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on public.categories for delete using (auth.uid() = user_id);

create policy "Users can view own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions for delete using (auth.uid() = user_id);

create policy "Users can view own recurring bills" on public.recurring_bills for select using (auth.uid() = user_id);
create policy "Users can insert own recurring bills" on public.recurring_bills for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring bills" on public.recurring_bills for update using (auth.uid() = user_id);
create policy "Users can delete own recurring bills" on public.recurring_bills for delete using (auth.uid() = user_id);

create policy "Users can view own savings goals" on public.savings_goals for select using (auth.uid() = user_id);
create policy "Users can insert own savings goals" on public.savings_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own savings goals" on public.savings_goals for update using (auth.uid() = user_id);
create policy "Users can delete own savings goals" on public.savings_goals for delete using (auth.uid() = user_id);

create policy "Users can view own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can upsert own settings" on public.user_settings for all using (auth.uid() = user_id);

-- 4. Automatically seed default categories when a new user signs up
create or replace function public.handle_new_user_setup()
returns trigger as $$
begin
  -- Insert default user settings
  insert into public.user_settings (user_id, currency, monthly_budget)
  values (new.id, '₱', 25000)
  on conflict (user_id) do nothing;

  -- Insert cheerful default categories
  insert into public.categories (user_id, name, emoji, color, monthly_limit) values
    (new.id, 'Food & Groceries', '🍱', '#FFD1DC', 8000),
    (new.id, 'Coffee & Treats', '🧋', '#FFE5B4', 2500),
    (new.id, 'Transportation', '🚌', '#BFE3F7', 3000),
    (new.id, 'Bills & Utilities', '⚡', '#C8E6C9', 6000),
    (new.id, 'Shopping & Needs', '🛍️', '#E1BEE7', 3500),
    (new.id, 'Self-Care & Health', '🌸', '#FFCDD2', 2000),
    (new.id, 'Fun & Hobbies', '🎮', '#FFF9C4', 2000),
    (new.id, 'Salary & Income', '💼', '#B2DFDB', 0);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to run after auth.users creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_setup();

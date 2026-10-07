// ====================================================================
// CLOUDY BUDGET - SUPABASE CLIENT & CLOUD SYNC
// Zero config required: automatically works with local storage
// Optional: connect your free Supabase project in Settings anytime!
// ====================================================================

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseCredentials() {
  // 1. Check runtime localStorage override (configured in Settings)
  const storedUrl = localStorage.getItem('cloudy_supabase_url');
  const storedKey = localStorage.getItem('cloudy_supabase_anon_key');
  if (storedUrl && storedKey) {
    return { url: storedUrl.trim(), key: storedKey.trim() };
  }

  // 2. Check Vite environment variables (from .env or Netlify env vars)
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey && !envUrl.includes('your-project-id')) {
    return { url: envUrl.trim(), key: envKey.trim() };
  }

  return null;
}

export function isSupabaseConfigured() {
  const creds = getSupabaseCredentials();
  return Boolean(creds && creds.url && creds.key);
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const creds = getSupabaseCredentials();
  if (creds) {
    try {
      supabaseClient = createClient(creds.url, creds.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseClient;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export function configureSupabase(url, key) {
  if (!url || !key) {
    localStorage.removeItem('cloudy_supabase_url');
    localStorage.removeItem('cloudy_supabase_anon_key');
    supabaseClient = null;
    return false;
  }
  localStorage.setItem('cloudy_supabase_url', url.trim());
  localStorage.setItem('cloudy_supabase_anon_key', key.trim());
  supabaseClient = null;
  return Boolean(getSupabase());
}

export async function testSupabaseConnection(url, key) {
  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.auth.getSession();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message || 'Could not connect' };
  }
}

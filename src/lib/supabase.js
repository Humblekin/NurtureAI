import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'NurtureAI: Supabase credentials not configured. Running in offline-only mode. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;

export default supabase;

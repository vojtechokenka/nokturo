import { createClient } from '@supabase/supabase-js';
import { isElectron } from '@/utils/platform';

// TODO: Po deployi přidat do Supabase Dashboard → Settings → API:
// Site URL: https://nokturo.co/app
// Redirect URLs: https://nokturo.co/app/**

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials not found. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Web: Supabase potřebuje detekovat tokeny v URL po auth redirectu
    // Electron: hash router — tokeny detekuje ručně AuthCallback
    detectSessionInUrl: !isElectron(),
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-info': 'nokturo-app',
    },
  },
});

import { createClient } from '@supabase/supabase-js';

// Public URL and publishable key are intended for browser clients.
// Database access is protected by the Row Level Security policies.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nccwyqkqfcepfhegjlup.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dSclmcCMG_pYyo61gP_EDw_1TYuA6f2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * A Supabase client with no stored session. Used for login (signInWithPassword)
 * because it runs before any user session exists.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

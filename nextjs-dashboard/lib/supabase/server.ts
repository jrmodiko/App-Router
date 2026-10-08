import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

/**
 * Server-side Supabase client for use in server components and server actions.
 *
 * If the user is logged in, their Supabase access token (kept in the NextAuth
 * session) is attached as the Authorization header. PostgREST uses it to run
 * RLS policies and resolve auth.uid() for column defaults (e.g. patients.user_id).
 */
export async function createClient() {
  const session = await auth();
  const accessToken = session?.supabaseAccessToken;

  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
    },
  );
}

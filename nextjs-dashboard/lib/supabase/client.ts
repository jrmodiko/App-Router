import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client for client components (e.g. the realtime
 * subscription in app/ui/refresh-on-change.tsx).
 *
 * It uses the NEXT_PUBLIC_* vars so Next.js inlines them into the client
 * bundle. There is no Supabase session in the browser — NextAuth owns the
 * session — so nothing is persisted to storage.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
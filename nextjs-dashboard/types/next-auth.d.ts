import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

type SupabaseSessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

declare module 'next-auth' {
  interface Session {
    /** Supabase access token used by lib/supabase/server.ts for RLS */
    supabaseAccessToken?: string;
  }

  interface User {
    /** Returned by authorize() on successful Supabase Auth sign-in */
    supabaseSession?: SupabaseSessionTokens;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    supabaseAccessToken?: string;
    supabaseRefreshToken?: string;
    supabaseExpiresAt?: number;
  }
}

export {};

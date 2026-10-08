import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/**
 * Supabase access tokens expire (1h by default). When they are close to
 * expiry, use the refresh token to get a new session so RLS keeps working.
 */
async function refreshSupabaseToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ refresh_token: token.supabaseRefreshToken }),
      },
    );

    if (!res.ok) {
      throw new Error(`Supabase refresh failed: ${await res.text()}`);
    }

    const session = await res.json();
    return {
      ...token,
      supabaseAccessToken: session.access_token,
      supabaseRefreshToken: session.refresh_token,
      supabaseExpiresAt: session.expires_at,
    };
  } catch (error) {
    console.error('Failed to refresh Supabase token:', error);
    return { ...token, supabaseAccessToken: undefined, supabaseExpiresAt: undefined };
  }
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, store the Supabase session tokens from authorize()
      const supabaseSession = user?.supabaseSession;
      if (supabaseSession) {
        token.supabaseAccessToken = supabaseSession.access_token;
        token.supabaseRefreshToken = supabaseSession.refresh_token;
        token.supabaseExpiresAt = supabaseSession.expires_at;
      }

      // Refresh shortly before the Supabase access token expires
      if (
        token.supabaseRefreshToken &&
        token.supabaseExpiresAt &&
        Date.now() / 1000 > token.supabaseExpiresAt - 60
      ) {
        return refreshSupabaseToken(token);
      }

      return token;
    },
    session({ session, token }) {
      session.supabaseAccessToken = token.supabaseAccessToken;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;

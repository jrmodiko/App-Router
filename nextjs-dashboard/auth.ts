import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { createAnonClient } from '@/lib/supabase/anon';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) return null;

        const { email, password } = parsedCredentials.data;

        // Authenticate against Supabase Auth (auth.users), not the public users table.
        const supabase = createAnonClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.session) {
          console.log('Invalid credentials:', error?.message);
          return null;
        }

        // Returning the Supabase session tokens lets the jwt callback store
        // them, so server-side Supabase queries run as this user (RLS / auth.uid()).
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name ?? email,
          supabaseSession: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
          },
        };
      },
    }),
  ],
});



import NextAuth from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GithubProvider from 'next-auth/providers/github';
import { env } from '@/lib/env';
import { fetchGithubLogin, readGithubLogin } from '@/lib/github-profile';

// Google token refresh logic removed as we are switching to GitHub
// GitHub tokens typically don't require offline access/refresh tokens in the same way for basic auth,
// but if we need it for API access we can add it later.

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
    
    maxAge: 30 * 24 * 60 * 60, 
  },

  secret: env.nextAuth.secret,

  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    

    async jwt({ token, account, user, profile }): Promise<JWT> {
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          refreshToken: account.refresh_token,
          githubLogin: readGithubLogin(profile) ?? token.githubLogin,
          githubLoginAttempted: Boolean(readGithubLogin(profile) ?? token.githubLogin),
          githubLoginAttemptedAt: Date.now(),
        };
      }

      // Negative lookups are cached for a day so one bad network day doesn't
      // pin the handle to undefined for the whole 30-day JWT lifetime.
      const attemptStale =
        token.githubLoginAttemptedAt != null &&
        Date.now() - token.githubLoginAttemptedAt > 24 * 3600 * 1000;
      if (
        !token.githubLogin &&
        (!token.githubLoginAttempted || attemptStale) &&
        token.accessToken
      ) {
        token.githubLogin = await fetchGithubLogin(token.accessToken);
        token.githubLoginAttempted = true;
        token.githubLoginAttemptedAt = Date.now();
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // With GitHub we don't strictly need refresh token rotation for basic identity
      return token;
    },

    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub as string,
          githubLogin: token.githubLogin,
        },
        error: token.error as Session['error'],
      };
    },
  },

  
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);

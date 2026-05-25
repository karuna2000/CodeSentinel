/**
 * NextAuth v4 configuration.
 *
 * Security features:
 * - Google OAuth with PKCE (enabled by default in NextAuth v4 Google provider)
 * - JWT session strategy — tokens stored in encrypted httpOnly cookie
 * - Server-side access token refresh when token expires
 * - No tokens exposed to client-side JavaScript
 */

import NextAuth from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/lib/env';
import type { OAuthTokenResponse } from '@/types/auth.types';

// ─── Access Token Refresh ─────────────────────────────────────────────────────

/**
 * Exchange a Google refresh token for a new access token.
 * Runs entirely server-side inside the `jwt` callback.
 */
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const refreshed = (await response.json()) as OAuthTokenResponse;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google only returns a new refresh token occasionally — keep old one if absent
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('[auth] Failed to refresh access token:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

// ─── NextAuth Options ─────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      // Request offline access to obtain a refresh_token
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          response_type: 'code',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    // Max age of the session cookie
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: env.nextAuth.secret,

  // Custom pages
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    /**
     * jwt — runs every time a JWT is created or refreshed.
     * On first sign-in: store Google tokens in the JWT.
     * On subsequent requests: refresh if expired.
     */
    async jwt({ token, account, user }): Promise<JWT> {
      // Initial sign-in — persist Google tokens into the JWT
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000  // convert seconds → ms
            : Date.now() + 3600 * 1000,  // fallback: 1h
          refreshToken: account.refresh_token,
        };
      }

      // Access token still valid — return unchanged
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token expired — refresh it
      return refreshGoogleAccessToken(token);
    },

    /**
     * session — shapes the Session object exposed to the app.
     * Sensitive tokens are NOT forwarded to the client Session.
     */
    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub as string,
        },
        // Forward error state so UI can react (e.g. force re-login)
        error: token.error as Session['error'],
      };
    },
  },

  // Enable debug logs in development only
  debug: process.env.NODE_ENV === 'development',
};

// Export the configured NextAuth handler
export default NextAuth(authOptions);

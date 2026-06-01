

import NextAuth from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import { env } from '@/lib/env';
import type { OAuthTokenResponse } from '@/types/auth.types';

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
      
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('[auth] Failed to refresh access token:', error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      
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
    
    maxAge: 30 * 24 * 60 * 60, 
  },

  secret: env.nextAuth.secret,

  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    

    async jwt({ token, account, user }): Promise<JWT> {
      
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000  
            : Date.now() + 3600 * 1000,  
          refreshToken: account.refresh_token,
        };
      }

      
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      
      return refreshGoogleAccessToken(token);
    },

    

    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub as string,
        },
        
        error: token.error as Session['error'],
      };
    },
  },

  
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);

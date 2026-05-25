import type { DefaultSession, DefaultUser } from 'next-auth';
import type { JWT as DefaultJWT } from 'next-auth/jwt';

// ─── Augment next-auth Session ──────────────────────────────────────────────
declare module 'next-auth' {
  interface Session extends DefaultSession {
    /** Google OAuth access token (server-side only, never exposed to JS) */
    accessToken?: string;
    /** UTC epoch seconds when the access token expires */
    accessTokenExpires?: number;
    /** Whether the last token refresh failed */
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

// ─── Augment JWT ─────────────────────────────────────────────────────────────
declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: 'RefreshAccessTokenError';
  }
}

// ─── Standalone types ────────────────────────────────────────────────────────
export type AuthSession = import('next-auth').Session;
export type AuthUser = import('next-auth').User;
export type AuthToken = import('next-auth/jwt').JWT;

export type AuthError = 'RefreshAccessTokenError' | 'OAuthAccountNotLinked' | 'AccessDenied';

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
}

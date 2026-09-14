import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    
    accessToken?: string;
    
    accessTokenExpires?: number;
    
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
      githubLogin?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    githubLogin?: string;
    githubLoginAttempted?: boolean;
    error?: 'RefreshAccessTokenError';
  }
}

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

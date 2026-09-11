

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockJWT {
  sub?: string;
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  error?: string;
}

interface MockOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: 'Bearer';
  scope: string;
}

async function refreshGoogleAccessToken(
  token: MockJWT,
  fetchFn: typeof globalThis.fetch
): Promise<MockJWT> {
  try {
    const response = await fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshed = (await response.json()) as MockOAuthTokenResponse;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

async function jwtCallback(
  token: MockJWT,
  refreshFn: (t: MockJWT, fetch: typeof globalThis.fetch) => Promise<MockJWT>,
  fetchFn: typeof globalThis.fetch,
  account?: { access_token: string; expires_at: number; refresh_token: string },
  user?: { id: string }
): Promise<MockJWT> {
  
  if (account && user) {
    return {
      ...token,
      accessToken: account.access_token,
      accessTokenExpires: account.expires_at * 1000,
      refreshToken: account.refresh_token,
    };
  }

  
  if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
    return token;
  }

  
  return refreshFn(token, fetchFn);
}

describe('JWT callback', () => {
  it('stores Google tokens on initial sign-in', async () => {
    const account = {
      access_token: 'goog-access-token-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'goog-refresh-token-abc',
    };
    const user = { id: 'user-001' };
    const token: MockJWT = { sub: 'user-001' };

    const result = await jwtCallback(token, refreshGoogleAccessToken, fetch, account, user);

    expect(result.accessToken).toBe('goog-access-token-123');
    expect(result.refreshToken).toBe('goog-refresh-token-abc');
    expect(result.accessTokenExpires).toBeGreaterThan(Date.now());
    expect(result.error).toBeUndefined();
  });

  it('returns existing token unchanged when access token is still valid', async () => {
    const validToken: MockJWT = {
      sub: 'user-001',
      accessToken: 'valid-access-token',
      accessTokenExpires: Date.now() + 60_000, 
      refreshToken: 'my-refresh-token',
    };

    const result = await jwtCallback(validToken, refreshGoogleAccessToken, fetch);

    expect(result.accessToken).toBe('valid-access-token');
    expect(result.error).toBeUndefined();
  });

  it('attempts token refresh when access token is expired', async () => {
    const expiredToken: MockJWT = {
      sub: 'user-001',
      accessToken: 'old-access-token',
      accessTokenExpires: Date.now() - 1000, 
      refreshToken: 'valid-refresh-token',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      } satisfies MockOAuthTokenResponse),
    } as unknown as Response);

    const result = await jwtCallback(expiredToken, refreshGoogleAccessToken, mockFetch as unknown as typeof globalThis.fetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.accessToken).toBe('new-access-token');
    expect(result.accessTokenExpires).toBeGreaterThan(Date.now());
    expect(result.error).toBeUndefined();
  });

  it('preserves existing refresh token if new one is not returned', async () => {
    const expiredToken: MockJWT = {
      accessToken: 'old',
      accessTokenExpires: Date.now() - 1000,
      refreshToken: 'original-refresh-token',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'fresh-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email',
        
      } satisfies MockOAuthTokenResponse),
    } as unknown as Response);

    const result = await jwtCallback(expiredToken, refreshGoogleAccessToken, mockFetch as unknown as typeof globalThis.fetch);

    
    expect(result.refreshToken).toBe('original-refresh-token');
    expect(result.accessToken).toBe('fresh-access-token');
  });

  it('sets RefreshAccessTokenError when refresh request fails', async () => {
    const expiredToken: MockJWT = {
      accessToken: 'old',
      accessTokenExpires: Date.now() - 1000,
      refreshToken: 'invalid-refresh-token',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    } as Response);

    const result = await jwtCallback(expiredToken, refreshGoogleAccessToken, mockFetch as unknown as typeof globalThis.fetch);

    expect(result.error).toBe('RefreshAccessTokenError');
    
    expect(result.refreshToken).toBe('invalid-refresh-token');
  });

  it('sets RefreshAccessTokenError when fetch throws a network error', async () => {
    const expiredToken: MockJWT = {
      accessToken: 'old',
      accessTokenExpires: Date.now() - 1000,
      refreshToken: 'refresh-token',
    };

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await jwtCallback(expiredToken, refreshGoogleAccessToken, mockFetch as unknown as typeof globalThis.fetch);

    expect(result.error).toBe('RefreshAccessTokenError');
  });
});

describe('AuthError types', () => {
  it('RefreshAccessTokenError is the correct sentinel value', () => {
    const error: MockJWT['error'] = 'RefreshAccessTokenError';
    expect(error).toBe('RefreshAccessTokenError');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fetchGithubLogin, readGithubLogin } from '@/lib/github-profile';

describe('readGithubLogin', () => {
  it('reads a trimmed login from a GitHub profile object', () => {
    expect(readGithubLogin({ login: '  karuna2000  ' })).toBe('karuna2000');
  });

  it('ignores missing or empty logins', () => {
    expect(readGithubLogin(null)).toBeUndefined();
    expect(readGithubLogin({ login: '   ' })).toBeUndefined();
    expect(readGithubLogin({ name: 'Karuna' })).toBeUndefined();
  });
});

describe('fetchGithubLogin', () => {
  it('returns the login from GET /user', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'karuna2000' }),
    } as Response);

    await expect(fetchGithubLogin('token')).resolves.toBe('karuna2000');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it('returns undefined when GitHub rejects the token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    await expect(fetchGithubLogin('bad')).resolves.toBeUndefined();
    fetchMock.mockRestore();
  });
});

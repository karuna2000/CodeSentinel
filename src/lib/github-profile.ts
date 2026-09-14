export function readGithubLogin(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const login = (source as { login?: unknown }).login;
  if (typeof login !== 'string') return undefined;
  const trimmed = login.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function fetchGithubLogin(
  accessToken: string,
): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeSentinel',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return undefined;
    return readGithubLogin(await res.json());
  } catch {
    return undefined;
  }
}

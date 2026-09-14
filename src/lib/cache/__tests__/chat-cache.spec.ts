import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_CACHE_TTL_SECONDS,
  buildCacheKey,
  getCacheClient,
  getCachedAnswer,
  hashQuery,
  isCacheEnabled,
  setCachedAnswer,
  type CachedAnswer,
} from '../chat-cache';

const ANSWER: CachedAnswer = {
  text: 'Auth lives in middleware. [E1]',
  intent: 'locate',
  status: 'grounded',
  evidence: [{ id: 'E1' }],
  followUps: ['What calls verifyJWT?'],
  stats: { lexicalHits: 1, semanticHits: 1, graphExpanded: 0 },
  gates: [{ gate: 'citation_coverage', pass: true, detail: 'ok' }],
};

function fakeClient(store: Map<string, string> = new Map(), fail = false) {
  return {
    isOpen: true,
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(async (key: string) => {
      if (fail) throw new Error('redis down');
      return store.has(key) ? store.get(key)! : null;
    }),
    set: vi.fn(async (key: string, value: string) => {
      if (fail) throw new Error('redis down');
      store.set(key, value);
      return 'OK';
    }),
  };
}

describe('hashQuery / buildCacheKey', () => {
  it('normalizes whitespace so identical questions share entries', () => {
    expect(hashQuery('  How does auth work?  ')).toBe(hashQuery('How does auth work?'));
  });

  it('scopes keys to repo + commit so re-indexes invalidate', () => {
    const a = buildCacheKey('r1', 'sha-a', 'q');
    const b = buildCacheKey('r1', 'sha-b', 'q');
    const c = buildCacheKey('r2', 'sha-a', 'q');
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a.startsWith('codesintler:chat:r1:sha-a:')).toBe(true);
  });

  it('handles repos without a commit sha', () => {
    expect(buildCacheKey('r1', null, 'q')).toContain(':unindexed:');
  });
});

describe('getCachedAnswer', () => {
  it('returns null without a client (cache disabled)', async () => {
    await expect(getCachedAnswer('k', null)).resolves.toBeNull();
  });

  it('round-trips a stored answer', async () => {
    const store = new Map([[ 'k', JSON.stringify(ANSWER) ]]);
    await expect(getCachedAnswer('k', fakeClient(store) as never)).resolves.toEqual(ANSWER);
  });

  it('rejects corrupt or shape-invalid payloads', async () => {
    const store = new Map([
      ['bad-json', '{oops'],
      ['bad-shape', JSON.stringify({ text: 42 })],
    ]);
    const client = fakeClient(store) as never;
    await expect(getCachedAnswer('bad-json', client)).resolves.toBeNull();
    await expect(getCachedAnswer('bad-shape', client)).resolves.toBeNull();
  });

  it('treats Redis errors as misses', async () => {
    await expect(getCachedAnswer('k', fakeClient(new Map(), true) as never)).resolves.toBeNull();
  });
});

describe('setCachedAnswer', () => {  it('returns false without a client', async () => {
    await expect(setCachedAnswer('k', ANSWER, null)).resolves.toBe(false);
  });

  it('stores with TTL and reports Redis errors as false', async () => {
    const store = new Map<string, string>();
    const ok = fakeClient(store);
    await expect(setCachedAnswer('k', ANSWER, ok as never)).resolves.toBe(true);
    expect(ok.set).toHaveBeenCalledWith('k', expect.any(String), { EX: CHAT_CACHE_TTL_SECONDS });
    expect(CHAT_CACHE_TTL_SECONDS).toBe(7 * 24 * 3600);
    await expect(setCachedAnswer('k', ANSWER, fakeClient(store, true) as never)).resolves.toBe(
      false,
    );
  });
});

describe('client lifecycle', () => {
  it('returns null without REDIS_URL and passes overrides through', async () => {
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      await expect(getCacheClient()).resolves.toBeNull();
      expect(isCacheEnabled()).toBe(false);
    } finally {
      if (saved !== undefined) process.env.REDIS_URL = saved;
    }
    const override = fakeClient();
    await expect(getCacheClient(override as never)).resolves.toBe(override);
  });

  it('pins current hash behavior (trimmed, case-sensitive, 32 hex chars)', () => {
    expect(hashQuery('  Hi  ')).toBe(hashQuery('Hi'));
    expect(hashQuery('Auth')).not.toBe(hashQuery('auth'));
    expect(hashQuery('q')).toMatch(/^[0-9a-f]{32}$/);
  });
});

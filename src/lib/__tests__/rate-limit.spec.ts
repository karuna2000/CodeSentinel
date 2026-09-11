import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockLimit, mockSlidingWindow, mockFromEnv, MockRatelimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockSlidingWindow = vi.fn(() => ({ _limiter: true }));
  const mockFromEnv = vi.fn(() => ({ _redis: true }));
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow = mockSlidingWindow;
  }
  return { mockLimit, mockSlidingWindow, mockFromEnv, MockRatelimit };
});

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: MockRatelimit }));
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: mockFromEnv } }));

type RateLimitModule = typeof import('@/lib/rate-limit');

const DEFAULT_CONFIG = { windowMs: 60_000, maxRequests: 3 };

function clearRedisEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

async function loadModule(url?: string, token?: string): Promise<RateLimitModule> {
  clearRedisEnv();
  if (url) process.env.UPSTASH_REDIS_REST_URL = url;
  if (token) process.env.UPSTASH_REDIS_REST_TOKEN = token;
  vi.resetModules();
  return import('@/lib/rate-limit');
}

afterAll(() => {
  clearRedisEnv();
  vi.useRealTimers();
});

describe('in-memory fallback (no Upstash configured)', () => {
  it('allows requests up to maxRequests per window, then blocks', async () => {
    const { checkRateLimit } = await loadModule();

    const first = await checkRateLimit('user:1', DEFAULT_CONFIG);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(DEFAULT_CONFIG.maxRequests - 1);

    await checkRateLimit('user:1', DEFAULT_CONFIG);
    await checkRateLimit('user:1', DEFAULT_CONFIG);

    const blocked = await checkRateLimit('user:1', DEFAULT_CONFIG);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(DEFAULT_CONFIG.windowMs);
  });

  it('tracks different keys independently', async () => {
    const { checkRateLimit } = await loadModule();

    await checkRateLimit('x', DEFAULT_CONFIG);
    await checkRateLimit('x', DEFAULT_CONFIG);
    await checkRateLimit('x', DEFAULT_CONFIG);
    expect((await checkRateLimit('x', DEFAULT_CONFIG)).allowed).toBe(false);

    const other = await checkRateLimit('y', DEFAULT_CONFIG);
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(DEFAULT_CONFIG.maxRequests - 1);
  });

  it('resets the window once it elapses', async () => {
    vi.useFakeTimers();
    try {
      const { checkRateLimit } = await loadModule();
      const cfg = { windowMs: 1_000, maxRequests: 1 };

      expect((await checkRateLimit('k', cfg)).allowed).toBe(true);
      const blocked = await checkRateLimit('k', cfg);
      expect(blocked.allowed).toBe(false);

      vi.setSystemTime(Date.now() + 1_001);
      expect((await checkRateLimit('k', cfg)).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Upstash Redis-backed (global rate limiting)', () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it('maps a successful limit() to an allowed result', async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: DEFAULT_CONFIG.maxRequests,
      remaining: 2,
      reset: Date.now() + 40_000,
      pending: Promise.resolve(),
    });

    const { checkRateLimit } = await loadModule('https://test.upstash.io', 'secret');
    const res = await checkRateLimit('user:1', DEFAULT_CONFIG);

    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
    expect(mockSlidingWindow).toHaveBeenCalledWith(DEFAULT_CONFIG.maxRequests, '60000 ms');
    expect(mockLimit).toHaveBeenCalledWith('user:1');
  });

  it('maps a blocked limit() to retryAfterMs derived from reset', async () => {
    const reset = Date.now() + 5_000;
    mockLimit.mockResolvedValue({
      success: false,
      limit: DEFAULT_CONFIG.maxRequests,
      remaining: 0,
      reset,
      pending: Promise.resolve(),
    });

    const { checkRateLimit } = await loadModule('https://test.upstash.io', 'secret');
    const res = await checkRateLimit('user:2', DEFAULT_CONFIG);

    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterMs).toBeGreaterThan(0);
    expect(res.retryAfterMs).toBeLessThanOrEqual(5_000);
  });

  it('fails open to in-memory when Redis is unreachable', async () => {
    mockLimit.mockRejectedValue(new Error('connection refused'));

    const { checkRateLimit } = await loadModule('https://test.upstash.io', 'secret');
    const res = await checkRateLimit('user:3', DEFAULT_CONFIG);

    expect(res.allowed).toBe(true);
    expect(mockLimit).toHaveBeenCalledTimes(1);
  });
});
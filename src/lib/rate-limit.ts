import { API_RATE_LIMIT } from '@/config/app.config';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= API_RATE_LIMIT.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: API_RATE_LIMIT.maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= API_RATE_LIMIT.maxRequests) {
    const retryAfterMs = API_RATE_LIMIT.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: API_RATE_LIMIT.maxRequests - entry.count,
    retryAfterMs: 0,
  };
}

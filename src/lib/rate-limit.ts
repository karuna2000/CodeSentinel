import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { API_RATE_LIMIT } from '@/config/app.config';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface MemoryEntry {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, MemoryEntry>();

// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, rate limits are
// enforced globally across all instances (works on Edge + Node). Otherwise we fall
// back to a per-instance in-memory store so local dev and tests keep working.
const USE_REDIS = Boolean(env.upstash.redisRestUrl && env.upstash.redisRestToken);

// Upstash Ratelimit exposes one limiter per instance; cache per (maxRequests, windowMs)
// so different API buckets (auth, chat, wiki, promote, …) keep their own windows.
const ratelimitInstances = new Map<string, Ratelimit>();

function getRatelimit(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.maxRequests}:${config.windowMs}`;
  let instance = ratelimitInstances.get(cacheKey);
  if (!instance) {
    instance = new Ratelimit({
      redis: Redis.fromEnv(),
      prefix: 'codeintellisense:ratelimit',
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs} ms`),
    });
    ratelimitInstances.set(cacheKey, instance);
  }
  return instance;
}

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: config.maxRequests - entry.count, retryAfterMs: 0 };
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = API_RATE_LIMIT,
): Promise<RateLimitResult> {
  if (!USE_REDIS) {
    return checkMemory(key, config);
  }

  try {
    const { success, remaining, reset } = await getRatelimit(config).limit(key);
    const now = Date.now();
    return {
      allowed: success,
      remaining,
      retryAfterMs: success ? 0 : Math.max(0, reset - now),
    };
  } catch (err) {
    // Fail open: never let rate limiting bring down the app if Redis is unreachable.
    logger.error('[RateLimit]', 'Redis rate limiter failed, falling back to in-memory', {
      error: err instanceof Error ? err.message : String(err),
      key,
    });
    return checkMemory(key, config);
  }
}
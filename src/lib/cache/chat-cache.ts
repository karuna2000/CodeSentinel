import { createHash } from 'node:crypto';
import { createClient, type RedisClientType } from 'redis';
import { logger } from '@/lib/logger';

/**
 * Chat answer cache (Phase C).
 *
 * Separate client from rate limiting on purpose: rate limits use
 * @upstash/redis (REST protocol, SaaS), while this cache speaks RESP to a
 * local/self-hosted Redis via REDIS_URL. When REDIS_URL is unset the cache
 * is disabled and every call is a miss — local dev without Redis keeps
 * working, just without savings.
 *
 * Key design: `chat:{repo_id}:{commit_sha}:{query_hash}`
 * - commit_sha scopes entries to the index they were grounded in, so a
 *   re-index auto-invalidates stale answers (no explicit invalidation).
 * - Only non-blocked, grounded answers are stored (never cache refusals or
 *   thin-evidence replies).
 */

export const CHAT_CACHE_TTL_SECONDS = 7 * 24 * 3600;
export const CHAT_CACHE_PREFIX = 'codesintler:chat';

export interface CachedAnswer {
  text: string;
  intent: string;
  status: string;
  evidence: unknown;
  followUps: string[];
  stats: unknown;
  gates: Array<{ gate: string; pass: boolean; detail: string }>;
}

type Client = Pick<RedisClientType, 'get' | 'set' | 'isOpen'> & {
  connect(): Promise<unknown>;
};

let singleton: Client | null = null;
let connectAttempted = false;

function redisUrl(): string | undefined {
  return process.env.REDIS_URL?.trim() || undefined;
}

/** Injectable for tests; production path lazily connects the singleton. */
export async function getCacheClient(override?: Client | null): Promise<Client | null> {
  if (override !== undefined) return override;
  const url = redisUrl();
  if (!url) return null;
  if (singleton) return singleton;
  if (connectAttempted) return null;
  connectAttempted = true;
  try {
    const client = createClient({ url }) as Client;
    await client.connect();
    singleton = client;
    return client;
  } catch (err) {
    logger.warn('[Cache]', 'Redis unavailable, answer cache disabled', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Stable hash of the normalized query — identical questions share entries. */
export function hashQuery(query: string): string {
  return createHash('sha256').update(query.trim()).digest('hex').slice(0, 32);
}

export function buildCacheKey(repoId: string, commitSha: string | null, query: string): string {
  return `${CHAT_CACHE_PREFIX}:${repoId}:${commitSha ?? 'unindexed'}:${hashQuery(query)}`;
}

export async function getCachedAnswer(
  key: string,
  client: Client | null,
): Promise<CachedAnswer | null> {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedAnswer>;
    if (typeof parsed.text !== 'string' || !Array.isArray(parsed.followUps)) return null;
    return parsed as CachedAnswer;
  } catch {
    return null;
  }
}

/** Best-effort store — failures resolve false, never throw. */
export async function setCachedAnswer(
  key: string,
  value: CachedAnswer,
  client: Client | null,
  ttlSeconds: number = CHAT_CACHE_TTL_SECONDS,
): Promise<boolean> {
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
}

export function isCacheEnabled(): boolean {
  return Boolean(redisUrl());
}

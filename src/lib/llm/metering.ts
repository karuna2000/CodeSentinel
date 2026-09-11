import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export type LlmFeature = 'reasoning' | 'chat' | 'intent-detect' | 'wiki';

export interface LlmUsageMeta {
  userId: string;
  repoId?: string | null;
  feature: LlmFeature;
  model?: string | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Shape of the SDK's LanguageModelUsage, which the various ai() results expose. */
export interface StreamUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** Sum of the user's LLM tokens consumed since the start of today (server tz). */
export async function getTodayTokenUsage(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const agg = await db.llmUsage.aggregate({
    where: { user_id: userId, created_at: { gte: startOfDay } },
    _sum: { total_tokens: true },
  });

  return agg._sum.total_tokens ?? 0;
}

export interface UsageBudget {
  allowed: boolean;
  usedTokens: number;
  capTokens: number;
  remainingTokens: number;
}

/**
 * Checks the user's daily LLM token budget. When no cap is configured
 * (capTokens <= 0) every request is allowed.
 */
export async function checkUsageBudget(userId: string): Promise<UsageBudget> {
  const cap = env.llm.dailyTokenCap;
  if (cap <= 0) {
    return { allowed: true, usedTokens: 0, capTokens: 0, remainingTokens: Infinity };
  }

  const used = await getTodayTokenUsage(userId);
  return {
    allowed: used < cap,
    usedTokens: used,
    capTokens: cap,
    remainingTokens: Math.max(0, cap - used),
  };
}

/** Persists a completed LLM call's token usage. */
export async function recordUsage(usage: StreamUsage, meta: LlmUsageMeta): Promise<void> {
  const inputTokens = Math.max(0, Math.round(usage.inputTokens || 0));
  const outputTokens = Math.max(0, Math.round(usage.outputTokens || 0));

  await db.llmUsage.create({
    data: {
      user_id: meta.userId,
      repo_id: meta.repoId ?? null,
      feature: meta.feature,
      model: meta.model ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  });
}

/**
 * Fire-and-forget metering for streaming responses. `usagePromise` resolves once
 * the stream has been fully consumed, so this never blocks the response and never
 * races the client disconnect. Failures are logged, never thrown to the caller.
 */
export function trackStreamUsage(
  usagePromise: PromiseLike<StreamUsage>,
  meta: LlmUsageMeta,
): void {
  void Promise.resolve(usagePromise)
    .then((usage) => recordUsage(usage, meta))
    .catch((err: unknown) => {
      logger.error('[Metering]', 'Failed to record LLM usage', {
        error: err instanceof Error ? err.message : String(err),
        userId: meta.userId,
        feature: meta.feature,
      });
    });
}

/** 429 response when the user's daily token budget is exhausted. */
export function buildUsageExceededResponse(usedTokens: number, capTokens: number): Response {
  return new Response(
    JSON.stringify({
      error: `Daily AI usage cap reached (${usedTokens.toLocaleString()} / ${capTokens.toLocaleString()} tokens used). Review and chat will resume tomorrow.`,
    }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
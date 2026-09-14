import { NextResponse } from 'next/server';
import { answerQuestion } from '@/features/chat/services/chat-pipeline';
import { checkUsageBudget, buildUsageExceededResponse } from '@/lib/llm/metering';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { INPUT_LIMITS } from '@/config/app.config';

export const maxDuration = 60;

const DEMO_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}

/**
 * POST /api/demo/query — anonymous grounded Q&A over allowlisted repos.
 *
 * Access control is the allowlist, not a session: the served repo is always
 * the first DEMO_REPO_IDS entry (no repoId parameter, so nothing outside the
 * list is addressable). Abuse containment is IP rate limiting + the shared
 * daily token budget keyed by `demo:{ip}`. No write endpoints exist in demo
 * scope (no promote / wiki-generate / index).
 */
export async function POST(request: Request) {
  const demoRepoIds = env.demo.repoIds;
  if (demoRepoIds.length === 0) {
    return NextResponse.json({ error: 'Demo is not enabled' }, { status: 404 });
  }

  const ip = clientIp(request);
  const actorId = `demo:${ip}`;

  const { allowed, retryAfterMs } = await checkRateLimit(`demo:${ip}`, DEMO_RATE_LIMIT);
  if (!allowed) {
    logger.warn('[Demo]', `Rate limit hit for IP ${ip}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  const budget = await checkUsageBudget(actorId);
  if (!budget.allowed) {
    return buildUsageExceededResponse(budget.usedTokens, budget.capTokens);
  }

  const repo = await db.repository.findFirst({
    where: { id: { in: demoRepoIds } },
    orderBy: { name: 'asc' },
    select: { id: true, owner: true, name: true, description: true, commit_sha: true },
  });
  if (!repo) {
    return NextResponse.json({ error: 'Demo repository is not indexed yet' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === 'string' ? body.query : '';
    if (!query.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }
    if (query.length > INPUT_LIMITS.chatMessageMaxChars) {
      return NextResponse.json(
        { error: `Message too long. Maximum is ${INPUT_LIMITS.chatMessageMaxChars} characters.` },
        { status: 400 },
      );
    }

    // Shared pipeline: retrieval → generation → guardrails → cache.
    const result = await answerQuestion({
      repoId: repo.id,
      commitSha: repo.commit_sha,
      actorId,
      query,
      history: [],
      useCache: true,
      persist: true,
    });

    return NextResponse.json({
      text: result.text,
      meta: result.meta,
      repo: { owner: repo.owner, name: repo.name, description: repo.description },
    });
  } catch (error) {
    logger.error('[Demo]', 'Demo query failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'There was a problem answering your question. Please try again.' },
      { status: 500 },
    );
  }
}

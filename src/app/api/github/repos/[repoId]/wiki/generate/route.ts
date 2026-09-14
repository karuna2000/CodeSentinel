import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { traceEvent } from '@/lib/observability';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { WIKI_RATE_LIMIT } from '@/config/app.config';
import { checkUsageBudget, buildUsageExceededResponse } from '@/lib/llm/metering';
import { enqueueWikiJob } from '@/server/jobs/wiki-jobs';
import { ensureWorkerRunning } from '@/server/workers/wiki-worker';

/** POST returns immediately with a jobId; generation runs in the background. */
export const maxDuration = 60;

export async function POST(
  request: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId } = params;
  const userId = session.user.id;

  // Rate limit: 3 wiki generation *attempts* per minute per user
  const { allowed, retryAfterMs } = await checkRateLimit(`wiki:${userId}`, WIKI_RATE_LIMIT);
  if (!allowed) {
    logger.warn('[Wiki Generate]', `Rate limit hit for user ${userId}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  // Verify repo belongs to this user
  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: userId },
    select: { id: true, name: true, is_indexed: true },
  });

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  if (!repo.is_indexed) {
    return NextResponse.json(
      { error: 'Repository must be indexed before generating the wiki. Please sync first.' },
      { status: 400 }
    );
  }

  // Daily LLM budget gate — wiki generation fans out into many LLM calls, so
  // refuse to enqueue once the user's daily token cap is exhausted.
  const budget = await checkUsageBudget(userId);
  if (!budget.allowed) {
    logger.warn('[Wiki Generate]', `Usage cap hit for user ${userId}`, {
      usedTokens: budget.usedTokens,
      capTokens: budget.capTokens,
    });
    return buildUsageExceededResponse(budget.usedTokens, budget.capTokens);
  }

  try {
    const job = await enqueueWikiJob(repoId, userId);
    ensureWorkerRunning();

    traceEvent('wiki_generation_enqueued', { userId, repoId, jobId: job.id });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        step: job.step,
      },
      { status: 202 },
    );
  } catch (error) {
    logger.error('[Wiki Generate]', 'Failed to enqueue wiki generation', {
      error: error instanceof Error ? error.message : String(error),
      repoId,
      userId,
    });
    return NextResponse.json(
      { error: 'Failed to enqueue wiki generation' },
      { status: 500 }
    );
  }
}
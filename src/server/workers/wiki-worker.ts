import { db } from '@/lib/db';
import type { GenerationJob, Prisma } from '@prisma/client';
import { generateWikiPages } from '@/features/wiki/services/module-summarizer';
import { generateFlowchart } from '@/features/wiki/services/mermaid-generator';
import { traceEvent } from '@/lib/observability';
import { logger } from '@/lib/logger';
import { recordUsage, checkUsageBudget } from '@/lib/llm/metering';
import { STALE_JOB_MS } from '@/server/jobs/wiki-jobs';

/** How often the in-process worker ticks for new jobs. */
const WORKER_POLL_MS = 5_000;
/** Max jobs processed by a single drain call / tick. */
const MAX_BATCH = 5;

/**
 * Atomically claims the next job to run. Race-safe: the conditional updateMany only
 * transitions a job from its observed status, so concurrent workers can't double-claim.
 * Jobs stuck RUNNING past STALE_JOB_MS are treated as crashed and reclaimed.
 */
async function claimNextJob(): Promise<GenerationJob | null> {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  const candidates = await db.generationJob.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'RUNNING', started_at: { lt: staleBefore } },
      ],
    },
    orderBy: { created_at: 'asc' },
    take: 10,
  });

  for (const candidate of candidates) {
    const claimed = await db.generationJob.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: 'RUNNING', started_at: new Date() },
    });
    if (claimed.count === 1) {
      return db.generationJob.findUnique({ where: { id: candidate.id } });
    }
  }
  return null;
}

/** Fire-and-forget progress write so a slow DB never blocks the LLM loop. */
function updateJobProgress(jobId: string, data: Prisma.GenerationJobUpdateInput): void {
  db.generationJob
    .update({ where: { id: jobId }, data })
    .catch(err => {
      logger.error('[WikiWorker]', `Progress update failed for job ${jobId}`, { error: String(err) });
    });
}

/** Runs a single claimed wiki job to completion and records the final status. */
export async function runWikiJob(jobId: string): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const start = Date.now();

  // Daily LLM budget gate: a job can sit queued while the user's cap is being
  // consumed elsewhere, so re-check before spending any tokens.
  const budget = await checkUsageBudget(job.user_id);
  if (!budget.allowed) {
    const message = `Daily AI usage cap reached (${budget.usedTokens.toLocaleString()} / ${budget.capTokens.toLocaleString()} tokens used). Review and chat will resume tomorrow.`;
    logger.warn('[WikiWorker]', `Job ${jobId} blocked by usage cap`, {
      repoId: job.repo_id,
      usedTokens: budget.usedTokens,
      capTokens: budget.capTokens,
    });
    await db.generationJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message, step: 'Usage cap reached', completed_at: new Date() },
    });
    traceEvent('job_wiki_blocked_budget', {
      jobId,
      repoId: job.repo_id,
      userId: job.user_id,
    });
    return;
  }

  try {
    resetJobStep(jobId);

    const wikiCount = await generateWikiPages(
      job.repo_id,
      (done, total, path) => {
        // Pages occupy 0–90% of the progress bar; the diagram gets the tail.
        const progress = Math.min(90, Math.round((done / total) * 90));
        updateJobProgress(jobId, {
          progress,
          step: `Summarizing ${path}… (${done}/${total})`,
          total,
        });
      },
      (usage) => {
        recordUsage(usage, {
          userId: job.user_id,
          repoId: job.repo_id,
          feature: 'wiki',
        }).catch(err => {
          logger.error('[WikiWorker]', `Failed to record wiki usage for job ${jobId}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      },
    );

    updateJobProgress(jobId, { progress: 95, step: 'Generating architecture diagram…' });
    await generateFlowchart(job.repo_id);

    await db.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        progress: 100,
        step: 'Done',
        wiki_pages: wikiCount,
        diagram: true,
        completed_at: new Date(),
      },
    });

    traceEvent('job_wiki_succeeded', {
      jobId,
      repoId: job.repo_id,
      wikiCount,
      timeTakenMs: Date.now() - start,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[WikiWorker]', `Job ${jobId} failed`, { error: message, repoId: job.repo_id });
    await db.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: message,
        step: 'Failed',
        completed_at: new Date(),
      },
    });
    traceEvent('job_wiki_failed', {
      jobId,
      repoId: job.repo_id,
      error: message,
      timeTakenMs: Date.now() - start,
    });
  }
}

function resetJobStep(jobId: string): void {
  updateJobProgress(jobId, { status: 'RUNNING', step: 'Starting…', progress: 1 });
}

/**
 * Claims and runs up to `limit` pending jobs. Returns how many were processed.
 * Safe to call from multiple processes/instances — only one worker wins each claim.
 */
export async function processWikiJobs(limit = MAX_BATCH): Promise<number> {
  let processed = 0;
  let job = await claimNextJob();

  while (job && processed < limit) {
    await runWikiJob(job.id);
    processed++;
    job = await claimNextJob();
  }

  return processed;
}

const globalForWorker = globalThis as unknown as { __wikiWorkerRunning?: boolean };

/**
 * Starts an in-process poller so long-lived servers (`next start`, `next dev`)
 * drain the queue themselves. No-op/no-op for serverless — those should call
 * POST /api/jobs/run from a cron instead. The singleton guard ensures only one
 * poller per process, and the atomic claim prevents double processing.
 */
export function ensureWorkerRunning(): void {
  if (globalForWorker.__wikiWorkerRunning) return;
  globalForWorker.__wikiWorkerRunning = true;

  setInterval(async () => {
    try {
      const processed = await processWikiJobs();
      if (processed > 0) {
        logger.info('[WikiWorker]', `Processed ${processed} job(s) on tick`);
      }
    } catch (err) {
      logger.error('[WikiWorker]', 'Worker tick failed', { error: String(err) });
    }
  }, WORKER_POLL_MS);
}
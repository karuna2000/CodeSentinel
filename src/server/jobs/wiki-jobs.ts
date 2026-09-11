import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { GenerationJob } from '@prisma/client';

/** A job stuck in RUNNING for longer than this is assumed crashed and re-claimable. */
export const STALE_JOB_MS = 30 * 60 * 1000;

/**
 * Returns an active (pending or healthy running) wiki job for a repo so we don't
 * enqueue duplicate generations for the same repository.
 */
export async function findActiveWikiJob(repoId: string): Promise<GenerationJob | null> {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  return db.generationJob.findFirst({
    where: {
      repo_id: repoId,
      type: 'wiki',
      OR: [
        { status: 'PENDING' },
        { status: 'RUNNING', started_at: { gte: staleBefore } },
      ],
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Enqueues a wiki generation job. Reuses an active job if one exists for the repo.
 * Returns the job — the caller should kick the worker afterwards.
 */
export async function enqueueWikiJob(repoId: string, userId: string): Promise<GenerationJob> {
  const existing = await findActiveWikiJob(repoId);
  if (existing) {
    logger.info('[JobQueue]', `Reusing active wiki job ${existing.id} for repo ${repoId}`);
    return existing;
  }

  const job = await db.generationJob.create({
    data: {
      repo_id: repoId,
      user_id: userId,
      type: 'wiki',
      status: 'PENDING',
      step: 'Queued',
      progress: 0,
    },
  });

  logger.info('[JobQueue]', `Enqueued wiki job ${job.id} for repo ${repoId}`, { userId });
  return job;
}

/**
 * Access control for the drain endpoint (POST /api/jobs/run).
 *
 * - When a secret is configured, the `x-jobs-secret` header must match exactly.
 * - Without a secret, only local development is allowed — never open an
 *   unauthenticated job runner in production.
 */
export function verifyDrainAccess(
  secretHeader: string | null,
  configuredSecret: string,
  isDev: boolean,
): boolean {
  if (configuredSecret) {
    return secretHeader === configuredSecret;
  }
  return isDev && secretHeader === null;
}
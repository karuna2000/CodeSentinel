import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { processWikiJobs } from '@/server/workers/wiki-worker';
import { verifyDrainAccess } from '@/server/jobs/wiki-jobs';

/** Runs pending background jobs. Intended for a cron trigger (e.g. Vercel Cron). */
export const maxDuration = 300;

export async function POST(request: Request) {
  const authorized = verifyDrainAccess(
    request.headers.get('x-jobs-secret'),
    env.jobs.runSecret,
    env.nodeEnv === 'development',
  );

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? 5);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(20, Math.max(1, Math.floor(rawLimit)))
    : 5;

  try {
    const processed = await processWikiJobs(limit);
    logger.info('[Jobs Run]', `Drained ${processed} job(s)`);
    return NextResponse.json({ processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Jobs Run]', 'Job drain failed', { error: message });
    return NextResponse.json({ error: 'Job processing failed' }, { status: 500 });
  }
}
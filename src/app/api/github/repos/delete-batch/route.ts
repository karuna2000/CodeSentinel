import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_BATCH_DELETE = 50;

/**
 * POST /api/github/repos/delete-batch — removes multiple repositories the user owns.
 *
 * Same semantics as the single-repo DELETE route: generation jobs are cleaned up
 * explicitly (no FK relation), the repository row cascades files -> graph ->
 * wiki -> diagrams, and LLM usage history is preserved as the metering ledger.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const { allowed } = await checkRateLimit(`delete-batch:${userId}`, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 },
    );
  }

  let repoIds: unknown;
  try {
    const body = (await request.json()) as { repoIds?: unknown };
    repoIds = body.repoIds;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!Array.isArray(repoIds) || repoIds.length === 0) {
    return NextResponse.json({ error: 'No repositories selected' }, { status: 400 });
  }

  const uniqueIds = [...new Set(repoIds)].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: 'No repositories selected' }, { status: 400 });
  }
  if (uniqueIds.length > MAX_BATCH_DELETE) {
    return NextResponse.json(
      { error: `Too many repositories selected. Maximum is ${MAX_BATCH_DELETE}.` },
      { status: 400 },
    );
  }

  const owned = await db.repository.findMany({
    where: { id: { in: uniqueIds }, user_id: userId },
    select: { id: true, owner: true, name: true },
  });
  if (owned.length === 0) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  const ownedIds = owned.map((r) => r.id);

  await db.$transaction(async (tx) => {
    await tx.generationJob.deleteMany({ where: { repo_id: { in: ownedIds } } });
    await tx.repository.deleteMany({ where: { id: { in: ownedIds }, user_id: userId } });
  });

  const repo = owned[0];
  const names = owned.map((r) => `${r.owner}/${r.name}`).join(', ');
  logger.info('[Repo Delete]', `Removed batch (${owned.length}): ${names}`, {
    userId,
    repoIds: ownedIds,
  });
  traceEvent('repository_removed_batch', {
    userId,
    count: owned.length,
    repos: names,
  });

  return NextResponse.json({
    success: true,
    deleted: owned.length,
    skipped: uniqueIds.length - owned.length,
    sample: repo ? `${repo.owner}/${repo.name}` : undefined,
  });
}

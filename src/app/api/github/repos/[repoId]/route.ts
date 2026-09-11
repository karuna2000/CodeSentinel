import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';

/**
 * DELETE /api/github/repos/[repoId] — removes a repository the user owns.
 *
 * Cascade deletes the file tree, graph nodes/edges, wiki pages, and diagrams.
 * Generation jobs are cleaned up explicitly (no FK relation). LLM usage history
 * is intentionally preserved: it is the user's daily metering ledger, and
 * deleting it would let a user reset their token budget by removing repos.
 */
export async function DELETE(
  _request: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { repoId } = params;

  const repo = await db.repository.findUnique({
    where: { id: repoId, user_id: userId },
    select: { id: true, owner: true, name: true },
  });
  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  // No FK relation — remove task state explicitly (wiki/chat jobs for this repo).
  await db.generationJob.deleteMany({ where: { repo_id: repoId } });

  // Cascades: files -> graph_nodes -> graph_edges, wiki_pages, diagrams.
  await db.repository.delete({ where: { id: repoId } });

  logger.info('[Repo Delete]', `Removed ${repo.owner}/${repo.name}`, { userId, repoId });
  traceEvent('repository_removed', { userId, repoId, repo: `${repo.owner}/${repo.name}` });

  return NextResponse.json({ success: true });
}
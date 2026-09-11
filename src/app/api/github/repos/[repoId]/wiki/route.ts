import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDocStaleness } from '@/features/wiki/services/doc-staleness';

/** GET /api/github/repos/[repoId]/wiki — returns the list of wiki pages (sidebar tree) */
export async function GET(
  request: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId } = params;

  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: session.user.id },
    select: { id: true },
  });
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [pages, diagrams, staleness] = await Promise.all([
    db.wikiPage.findMany({
      where: { repo_id: repoId },
      select: { id: true, path: true, title: true, commit_sha: true, updated_at: true },
      orderBy: { path: 'asc' },
    }),
    db.diagram.findMany({
      where: { repo_id: repoId },
      select: { id: true, path: true, type: true, commit_sha: true, updated_at: true },
      orderBy: { created_at: 'asc' },
    }),
    getDocStaleness(repoId),
  ]);

  return NextResponse.json({ pages, diagrams, staleness });
}

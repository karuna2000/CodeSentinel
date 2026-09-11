import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/** GET /api/github/repos/[repoId]/diagrams — returns all diagrams for a repo */
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

  const diagrams = await db.diagram.findMany({
    where: { repo_id: repoId },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({ diagrams });
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/** GET /api/github/repos/[repoId]/wiki/generate/[jobId] — polls a generation job */
export async function GET(
  request: Request,
  props: { params: Promise<{ repoId: string; jobId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId, jobId } = params;

  const job = await db.generationJob.findFirst({
    where: { id: jobId, repo_id: repoId, user_id: session.user.id },
    select: {
      id: true,
      status: true,
      step: true,
      progress: true,
      total: true,
      wiki_pages: true,
      diagram: true,
      error: true,
      created_at: true,
      completed_at: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
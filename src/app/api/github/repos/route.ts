import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeRepositories, syncUserRepositories } from '@/features/github/indexer/repo-sync';

async function listSerializedRepos(userId: string) {
  const allRepos = await db.repository.findMany({
    where: { user_id: userId },
    orderBy: { name: 'asc' },
  });
  return serializeRepositories(allRepos);
}

/** Read-only list of repositories already linked to this user. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const serializedRepos = await listSerializedRepos(session.user.id);
    const url = new URL(request.url);
    if (url.searchParams.get('redirect') === 'true') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.json({ repositories: serializedRepos });
  } catch (error) {
    console.error('Error listing GitHub repos:', error);
    return NextResponse.json({ error: 'Failed to list repositories' }, { status: 500 });
  }
}

/** Pull the user's GitHub App installations into the local repository table. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const repos = await syncUserRepositories(
      session.user.id,
      session.user.githubLogin,
    );
    return NextResponse.json({ repositories: serializeRepositories(repos) });
  } catch (error) {
    console.error('Error syncing GitHub repos:', error);
    return NextResponse.json({ error: 'Failed to sync repositories' }, { status: 500 });
  }
}

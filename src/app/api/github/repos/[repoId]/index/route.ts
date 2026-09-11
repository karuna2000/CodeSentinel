import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { indexRepository } from '@/features/github/indexer/github-client';

export async function POST(
  request: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { repoId } = params;

  try {
    // 1. Fetch repository from database
    const repo = await db.repository.findUnique({
      where: {
        id: repoId,
        user_id: userId,
      }
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    // 2. Fetch the user's installation ID
    const installation = await db.githubInstallation.findFirst({
      where: { user_id: userId },
      select: { installation_id: true }
    });

    if (!installation) {
      return NextResponse.json(
        { error: 'No GitHub App installation found. Please reconnect your GitHub App.' },
        { status: 400 }
      );
    }

    const installationId = Number(installation.installation_id);

    // 3. Index repository tree and seed documentation
    const result = await indexRepository(
      installationId,
      repo.id,
      repo.owner,
      repo.name,
      repo.default_branch || 'main'
    );

    return NextResponse.json({
      success: true,
      repository: {
        id: repo.id,
        name: `${repo.owner}/${repo.name}`,
        fileCount: result.fileCount,
        hasReadme: result.hasReadme,
        readmeContent: result.readmeContent,
        lastSynced: result.lastSynced,
      },
    });
  } catch (error) {
    console.error('Error indexing repository:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to index repository' },
      { status: 500 }
    );
  }
}

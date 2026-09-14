import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { indexRepository } from '@/features/github/indexer/github-client';
import { resolveCurrentInstallations } from '@/features/github/indexer/installation-resolver';

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

    // 2. Resolve the user's active installations (GitHub-reconciled so a
    //    reinstalled app's fresh installation id is used, never a stale one).
    const installations = await resolveCurrentInstallations(userId);

    const ownerKey = repo.owner.toLowerCase();
    const installation = installations.find(
      (inst) => inst.account_name.toLowerCase() === ownerKey,
    );

    if (!installation) {
      return NextResponse.json(
        { error: 'No GitHub App installation found. Please reconnect your GitHub App.' },
        { status: 400 }
      );
    }

    // 3. Index repository tree and seed documentation
    const result = await indexRepository(
      installation.installation_id,
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
      { error: 'Failed to index repository' },
      { status: 500 }
    );
  }
}

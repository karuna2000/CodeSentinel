import '@/features/workspace/styles/workspace.css';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import WorkspaceView, {
  type WikiJobStatus,
  type WorkspaceRepo,
} from '@/features/workspace/components/workspace-view';

export const metadata = {
  title: 'Workspace | CodeSentinel',
  description:
    'Connect GitHub repositories, index them, generate wikis, and chat with your codebase.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  const userId = session.user.id;

  let repositories: WorkspaceRepo[] = [];
  let databaseUnavailable = false;
  try {
    const repos = await db.repository.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        owner: true,
        name: true,
        description: true,
        language: true,
        stars: true,
        default_branch: true,
        file_count: true,
        is_indexed: true,
        last_synced: true,
        commit_sha: true,
        _count: {
          select: { graph_nodes: true, graph_edges: true },
        },
      },
    });

    const jobs =
      repos.length > 0
        ? await db.generationJob.findMany({
            where: { repo_id: { in: repos.map((r) => r.id) } },
            orderBy: { created_at: 'desc' },
            select: {
              repo_id: true,
              status: true,
              progress: true,
              step: true,
              wiki_pages: true,
              diagram: true,
            },
          })
        : [];

    const latestByRepo = new Map<string, (typeof jobs)[number]>();
    for (const job of jobs) {
      if (!latestByRepo.has(job.repo_id)) latestByRepo.set(job.repo_id, job);
    }

    repositories = repos.map((repo) => {
      const job = latestByRepo.get(repo.id);
      return {
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        defaultBranch: repo.default_branch,
        fileCount: repo.file_count,
        readmeContent: null,
        isIndexed: repo.is_indexed,
        lastSynced: repo.last_synced ? repo.last_synced.toISOString() : null,
        commitSha: repo.commit_sha,
        symbolCount: repo._count.graph_nodes,
        edgeCount: repo._count.graph_edges,
        wikiStatus: job ? (job.status as WikiJobStatus) : null,
        wikiProgress: job?.progress ?? null,
        wikiStep: job?.step ?? null,
        wikiPages: job?.wiki_pages ?? null,
        diagram: job?.diagram ?? null,
      };
    });
  } catch (error) {
    databaseUnavailable = isDatabaseUnavailable(error);
    if (!databaseUnavailable) {
      console.error('Error loading workspace repositories:', error);
    }
  }

  const installUrl = env.githubAppName ? '/api/github/install' : undefined;

  return (
    <WorkspaceView
      initialRepositories={repositories}
      installUrl={installUrl}
      username={session.user.name || session.user.email || undefined}
      databaseUnavailable={databaseUnavailable}
    >
      {children}
    </WorkspaceView>
  );
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 'P1001' ||
    (typeof candidate.message === 'string' && /can't reach database server|cannot reach database server/i.test(candidate.message));
}

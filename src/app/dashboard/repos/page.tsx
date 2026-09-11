import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { RepoBrowserView, Repository } from './repo-browser-view';

export const metadata = {
  title: 'Repository Knowledge Base | CodeSentinel',
  description: 'Connect and index GitHub repositories for CodeSentinel Codebase Wikipedia',
};

export default async function RepoBrowserPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/repos');
  }

  const userId = session.user.id;

  // Fetch repositories for this user from database
  let repositories: Repository[] = [];
  try {
    const rawRepos = await db.repository.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' }
    });
    // Convert BigInt to string/number if needed by the frontend, but we can pass as is if configured
    // Wait, BigInt is not JSON serializable in Next.js by default.
    repositories = rawRepos.map((repo) => ({
      ...repo,
      github_repo_id: Number(repo.github_repo_id),
    })) as unknown as Repository[];
  } catch (error) {
    console.error('Error loading repositories:', error);
  }

  const installUrl = `https://github.com/apps/${env.githubAppName}/installations/new`;

  return (
    <RepoBrowserView
      initialRepositories={(repositories as Repository[]) || []}
      installUrl={installUrl}
      userLogin={session.user.name || undefined}
    />
  );
}


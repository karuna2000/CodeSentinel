import { db } from '@/lib/db';
import { getInstallationRepositories } from '@/features/github/indexer/github-client';
import {
  discoverAndClaimUserInstallation,
  resolveCurrentInstallations,
} from '@/features/github/indexer/installation-resolver';

export async function syncUserRepositories(
  userId: string,
  githubLogin?: string | null,
) {
  let installations = await resolveCurrentInstallations(userId);

  if (installations.length === 0) {
    try {
      await discoverAndClaimUserInstallation(userId, githubLogin);
    } catch (err) {
      console.warn('Could not discover GitHub App installation for user:', err);
    }
    installations = await resolveCurrentInstallations(userId);
  }

  for (const inst of installations) {
    try {
      const repos = await getInstallationRepositories(inst.installation_id);

      for (const repo of repos) {
        const repoData = {
          github_repo_id: repo.id,
          name: repo.name,
          owner: repo.owner.login,
          default_branch: repo.default_branch || 'main',
          language: repo.language || null,
          description: repo.description || null,
          stars: repo.stargazers_count || 0,
        };

        await db.repository.upsert({
          where: {
            user_id_github_repo_id: {
              user_id: userId,
              github_repo_id: repo.id,
            },
          },
          update: repoData,
          create: { ...repoData, user_id: userId },
        });
      }
    } catch (err) {
      console.error(`Failed to fetch repos for installation ${inst.installation_id}:`, err);
    }
  }

  return db.repository.findMany({
    where: { user_id: userId },
    orderBy: { name: 'asc' },
  });
}

export function serializeRepositories(
  repos: Awaited<ReturnType<typeof db.repository.findMany>>,
) {
  return repos.map((repo) => ({
    ...repo,
    github_repo_id: repo.github_repo_id.toString(),
  }));
}

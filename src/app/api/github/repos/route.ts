import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getInstallationRepositories, getAppClient } from '@/features/github/indexer/github-client';

export async function GET(request: Request) {
  // 1. Ensure user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = session.user.id;

  try {
    // 2. Fetch all GitHub installations for this user from DB
    let installations = await db.githubInstallation.findMany({
      where: { user_id: userId },
      select: { installation_id: true }
    });
    
    // 3. Auto-discovery: If not found in DB, check GitHub App directly for active installations
    if (!installations || installations.length === 0) {
      try {
        const appClient = await getAppClient();
        const { data: ghInstallations } = await appClient.rest.apps.listInstallations();

        if (ghInstallations && ghInstallations.length > 0) {
          const newInstList = [];
          for (const inst of ghInstallations) {
            const account = inst.account as { login?: string; name?: string } | null;
            const accountName = account?.login || account?.name || 'Account';
            
            const newInst = await db.githubInstallation.upsert({
              where: { installation_id: inst.id },
              update: { user_id: userId, account_name: accountName },
              create: {
                installation_id: inst.id,
                user_id: userId,
                account_name: accountName,
              }
            });

            newInstList.push({ installation_id: newInst.installation_id });
          }
          installations = newInstList;
        }
      } catch (appErr) {
        console.warn('Could not auto-discover installations from GitHub App:', appErr);
      }
    }

    if (!installations || installations.length === 0) {
      return NextResponse.json({ repositories: [] });
    }

    // 4. For each installation, fetch accessible repositories and upsert
    for (const inst of installations) {
      try {
        const repos = await getInstallationRepositories(Number(inst.installation_id));
        
        for (const repo of repos) {
          const repoData = {
            github_repo_id: repo.id,
            name: repo.name,
            owner: repo.owner.login,
            default_branch: repo.default_branch || 'main',
            language: repo.language || null,
            description: repo.description || null,
            stars: repo.stargazers_count || 0,
            user_id: userId,
          };
          
          await db.repository.upsert({
            where: { github_repo_id: repo.id },
            update: repoData,
            create: repoData
          });
        }
      } catch (err) {
        console.error(`Failed to fetch repos for installation ${inst.installation_id}:`, err);
      }
    }

    // 5. Return all repositories for this user from the database
    const allRepos = await db.repository.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' }
    });

    const serializedRepos = allRepos.map(repo => ({
      ...repo,
      github_repo_id: repo.github_repo_id.toString(),
    }));

    const url = new URL(request.url);
    if (url.searchParams.get('redirect') === 'true') {
      return NextResponse.redirect(new URL('/dashboard/repos', request.url));
    }

    return NextResponse.json({ repositories: serializedRepos });

  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch repositories' }, { status: 500 });
  }
}



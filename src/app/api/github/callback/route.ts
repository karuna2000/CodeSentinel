import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAppClient } from '@/features/github/indexer/github-client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationIdStr = url.searchParams.get('installation_id');
  
  if (!installationIdStr) {
    return NextResponse.redirect(new URL('/?error=missing_installation_id', request.url));
  }

  const installationId = parseInt(installationIdStr, 10);
  
  // 1. Ensure user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // If not logged in, we could stash the installation_id in a cookie and redirect to login,
    // but for simplicity, we require them to be logged in first.
    return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(request.url)}`, request.url));
  }
  
  const userId = session.user.id;

  try {
    // 2. Verify the installation exists and get metadata via our GitHub App
    const appClient = await getAppClient();
    const { data: installation } = await appClient.rest.apps.getInstallation({
      installation_id: installationId,
    });

    const account = installation.account;
    const accountName = (account && 'login' in account ? account.login : account?.name) || 'Unknown Account';

    // 3. Save to database
    try {
      await db.githubInstallation.upsert({
        where: { installation_id: installationId },
        update: { user_id: userId, account_name: accountName },
        create: {
          installation_id: installationId,
          user_id: userId,
          account_name: accountName,
        }
      });
    } catch (error) {
      console.error('Failed to save GitHub installation:', error);
      return NextResponse.redirect(new URL('/?error=db_save_failed', request.url));
    }

    // 4. Redirect to the repository browser dashboard
    return NextResponse.redirect(new URL('/dashboard/repos', request.url));

  } catch (error) {
    console.error('Error handling GitHub App callback:', error);
    return NextResponse.redirect(new URL('/?error=github_callback_failed', request.url));
  }
}

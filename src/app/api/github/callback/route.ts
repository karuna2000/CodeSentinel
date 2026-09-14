import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { claimGithubInstallation, InstallationClaimError } from '@/features/github/indexer/installation-resolver';
import { INSTALL_STATE_COOKIE } from '@/features/github/indexer/install-state';
import { secureCompare } from '@/lib/security';

function redirectWithError(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/?error=${code}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationIdStr = url.searchParams.get('installation_id');
  const state = url.searchParams.get('state');

  if (!installationIdStr) {
    return redirectWithError(request, 'missing_installation_id');
  }

  const installationId = parseInt(installationIdStr, 10);
  if (!Number.isFinite(installationId) || installationId <= 0) {
    return redirectWithError(request, 'invalid_installation_id');
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(request.url)}`, request.url),
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(INSTALL_STATE_COOKIE)?.value;
  if (!state || !expectedState || !secureCompare(state, expectedState)) {
    return redirectWithError(request, 'invalid_install_state');
  }

  try {
    await claimGithubInstallation(session.user.id, installationId);
  } catch (error) {
    if (error instanceof InstallationClaimError) {
      return redirectWithError(request, `github_claim_${error.code}`);
    }
    console.error('Error handling GitHub App callback:', error);
    return redirectWithError(request, 'github_callback_failed');
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set(INSTALL_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

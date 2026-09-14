import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';
import { INSTALL_STATE_COOKIE } from '@/features/github/indexer/install-state';

const STATE_MAX_AGE_SEC = 10 * 60;

/**
 * Starts the GitHub App install flow with a per-session CSRF `state`.
 * The setup callback refuses to bind an installation unless this cookie matches.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL('/auth/signin?callbackUrl=/api/github/install', request.url),
    );
  }

  if (!env.githubAppName) {
    return NextResponse.json({ error: 'GitHub App is not configured' }, { status: 500 });
  }

  const state = randomBytes(24).toString('hex');
  const installUrl = `https://github.com/apps/${env.githubAppName}/installations/new?state=${encodeURIComponent(state)}`;
  const response = NextResponse.redirect(installUrl);
  response.cookies.set(INSTALL_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: STATE_MAX_AGE_SEC,
  });
  return response;
}

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

const AUTH_PATHS = [
  '/auth/signin',
  '/auth/error',
];

const PUBLIC_PATHS: string[] = [
  // Anonymous demo (allowlist-scoped at the route level — see DEMO_REPO_IDS).
  '/demo',
  '/api/demo',
  // Prometheus scrape endpoint — aggregate labels only, no user/repo data.
  '/api/metrics',
];

const NEXTAUTH_PATHS = [
  '/api/auth',
];

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;

    if (NEXTAUTH_PATHS.some((p) => pathname.startsWith(p))) {
      const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const { allowed, retryAfterMs } = await checkRateLimit(`auth:${ip}`);
      if (!allowed) {
        logger.warn('[Middleware]', `Rate limit hit on auth route for IP ${ip}`);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        return new NextResponse(
          JSON.stringify({ error: `Rate limit exceeded. Try again in ${retryAfterSec}s.` }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) } }
        );
      }
    }

    const token = req.nextauth.token;

    const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

    
    if (isAuthPath && token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const { pathname } = req.nextUrl;

        const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
        const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
        const isNextAuthPath = NEXTAUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

        
        
        if (isAuthPath || isPublicPath || isNextAuthPath) {
          logger.debug('[Middleware]', `Path ${pathname} is allowed by path matching.`);
          return true;
        }

        logger.debug('[Middleware]', `Path ${pathname} checking token: ${!!token}`);
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};

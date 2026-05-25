import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

/**
 * Auth paths — used for authentication.
 * Authenticated users visiting these will be redirected to the dashboard.
 */
const AUTH_PATHS = [
  '/auth/signin',
  '/auth/error',
];

/**
 * Public paths — accessible to everyone.
 * Unauthenticated users can view these without being redirected.
 */
const PUBLIC_PATHS: string[] = [
  // Add public landing pages or docs here.
  // The root path '/' is our protected dashboard, so it is NOT here.
];

/**
 * NextAuth system paths — always public.
 */
const NEXTAUTH_PATHS = [
  '/api/auth',
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

    // 1. Authenticated user flow for auth pages
    if (isAuthPath && token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // 2. Allow request to continue
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const { pathname } = req.nextUrl;

        const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
        const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
        const isNextAuthPath = NEXTAUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

        // Always allow public, auth, and next-auth routes through this callback.
        // The middleware function above handles the authenticated-user-on-auth-path redirect.
        if (isAuthPath || isPublicPath || isNextAuthPath) {
          console.log(`[Middleware] Path ${pathname} is allowed by path matching.`);
          return true;
        }

        console.log(`[Middleware] Path ${pathname} checking token:`, !!token);
        // For all other routes (Protected Routes), require a valid session token.
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  // Run middleware on all routes except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};

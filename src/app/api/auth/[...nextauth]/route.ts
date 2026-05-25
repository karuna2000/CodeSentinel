/**
 * NextAuth v4 catch-all route handler.
 * Handles: GET  /api/auth/[...nextauth]  (OAuth redirect, session check, CSRF)
 *          POST /api/auth/[...nextauth]  (sign-in, sign-out, callback)
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

/**
 * Cookie security utilities.
 *
 * NextAuth manages its own session cookie with httpOnly + Secure + SameSite.
 * These utilities are for any additional auth-related cookies the app may need.
 */

import { cookies } from 'next/headers';

export const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Set a secure auth cookie (server-side only).
 * Never use this for tokens — NextAuth handles those.
 * Use for non-sensitive auth metadata (e.g. last-provider hint).
 */
export async function setAuthCookie(name: string, value: string, maxAge?: number) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    ...COOKIE_CONFIG,
    ...(maxAge !== undefined && { maxAge }),
  });
}

/**
 * Get an auth cookie value (server-side only).
 */
export async function getAuthCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

/**
 * Delete an auth cookie (server-side only).
 */
export async function deleteAuthCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

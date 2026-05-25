'use server';

/**
 * Auth Server Actions.
 * Called from Client Components to trigger sign-in and sign-out.
 * These run on the server — no token exposure to the browser.
 */

import { signIn, signOut } from 'next-auth/react';

/**
 * Initiate Google OAuth sign-in flow.
 * Redirects to Google consent screen, then back to callbackUrl.
 */
export async function signInWithGoogle(callbackUrl = '/') {
  await signIn('google', { callbackUrl });
}

/**
 * Sign out and clear the session cookie.
 */
export async function signOutUser(callbackUrl = '/auth/signin') {
  await signOut({ callbackUrl });
}

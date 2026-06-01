'use server';

import { signIn, signOut } from 'next-auth/react';

export async function signInWithGoogle(callbackUrl = '/') {
  await signIn('google', { callbackUrl });
}

export async function signOutUser(callbackUrl = '/auth/signin') {
  await signOut({ callbackUrl });
}

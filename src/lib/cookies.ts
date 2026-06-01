

import { cookies } from 'next/headers';

export const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setAuthCookie(name: string, value: string, maxAge?: number) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    ...COOKIE_CONFIG,
    ...(maxAge !== undefined && { maxAge }),
  });
}

export async function getAuthCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function deleteAuthCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

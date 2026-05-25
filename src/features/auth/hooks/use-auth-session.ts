'use client';

/**
 * Thin wrapper around next-auth's useSession.
 * Provides convenient derived state for auth-gated components.
 */

import { useSession } from 'next-auth/react';
import type { AuthSession } from '@/types/auth.types';

export interface UseAuthSessionReturn {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasTokenError: boolean;
}

export function useAuthSession(): UseAuthSessionReturn {
  const { data: session, status } = useSession();

  return {
    session: session as AuthSession | null,
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    hasTokenError: (session as AuthSession | null)?.error === 'RefreshAccessTokenError',
  };
}

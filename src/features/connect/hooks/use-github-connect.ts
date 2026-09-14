'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface GitHubRepo {
  id: string;
  name: string;
  owner: string;
  [key: string]: unknown;
}

interface UseGitHubConnectOptions {
  onConnected?: (repositories: GitHubRepo[]) => void;
  onGaveUp?: () => void;
  onError?: () => void;
}

type CheckResult = { status: 'error' } | { status: 'ok'; repos: GitHubRepo[] | null };

const POLL_INTERVAL_MS = 4000;
const POLL_CAP = 20;

async function checkForRepos(): Promise<CheckResult> {
  try {
    const res = await fetch('/api/github/repos', { method: 'POST' });
    const data = (await res.json().catch(() => null)) as { repositories?: GitHubRepo[] } | null;
    if (!res.ok) {
      return { status: 'error' };
    }
    if (data && Array.isArray(data.repositories) && data.repositories.length > 0) {
      return { status: 'ok', repos: data.repositories };
    }
    return { status: 'ok', repos: null };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Opens the GitHub App install URL in a new tab, then polls the repos API until
 * CodeSentinel sees the newly granted repositories. Re-checks immediately when
 * the window is focused again (user coming back from GitHub settings).
 *
 * Hard failures (non-2xx / unreachable API) are surfaced via onError instead of
 * being treated as "still waiting", so a broken backend never masquerades as an
 * in-progress install — the user gets a human-readable message immediately.
 */
export function useGitHubConnect(installUrl?: string) {
  const [connecting, setConnecting] = useState(false);
  const timersRef = useRef<number[]>([]);
  const connectingRef = useRef(false);
  const inFlightRef = useRef(false);
  const triesRef = useRef(0);
  const optionsRef = useRef<UseGitHubConnectOptions>({});

  const stopPolling = useCallback(() => {
    timersRef.current.forEach((t) => window.clearInterval(t));
    timersRef.current = [];
    connectingRef.current = false;
    inFlightRef.current = false;
    setConnecting(false);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearInterval(t));
    };
  }, []);

  const runCheck = useCallback(async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    triesRef.current += 1;
    try {
      const result = await checkForRepos();
      const { onConnected, onGaveUp, onError } = optionsRef.current;
      if (result.status === 'error') {
        stopPolling();
        onError?.();
        return false;
      }
      if (result.repos) {
        stopPolling();
        onConnected?.(result.repos);
        return true;
      }
      if (connectingRef.current && triesRef.current >= POLL_CAP) {
        stopPolling();
        onGaveUp?.();
      }
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [stopPolling]);

  useEffect(() => {
    const onVisible = () => {
      if (!connectingRef.current) return;
      triesRef.current = 0;
      void runCheck();
    };
    window.addEventListener('focus', onVisible);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onVisible();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runCheck]);

  const connect = ({ onConnected, onGaveUp, onError }: UseGitHubConnectOptions = {}) => {
    if (!installUrl) return;
    optionsRef.current = { onConnected, onGaveUp, onError };
    triesRef.current = 0;
    connectingRef.current = true;
    setConnecting(true);
    window.open(installUrl, '_blank', 'noopener,noreferrer');
    void runCheck();
    const iv = window.setInterval(() => void runCheck(), POLL_INTERVAL_MS);
    timersRef.current.push(iv);
  };

  const checkNow = (options: UseGitHubConnectOptions = {}): Promise<boolean> => {
    optionsRef.current = { ...optionsRef.current, ...options };
    return runCheck();
  };

  const cancel = stopPolling;

  return { connecting, connect, cancel, checkNow };
}

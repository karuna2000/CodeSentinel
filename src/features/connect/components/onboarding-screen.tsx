'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { GithubMark } from '@/features/auth/components/github-mark';
import { useGitHubConnect } from '@/features/connect/hooks/use-github-connect';

interface OnboardingScreenProps {
  username?: string;
  installUrl?: string;
}

/**
 * First-time onboarding: shown whenever the user has no linked repositories.
 * Guides them through installing the CodeSentinel GitHub App and auto-enters
 * the workspace once repositories appear.
 */
export default function OnboardingScreen({
  username,
  installUrl,
}: OnboardingScreenProps) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  const [checked, setChecked] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const { connecting, connect, cancel, checkNow } =
    useGitHubConnect(installUrl);

  const handleConnect = () => {
    setGaveUp(false);
    setConnectFailed(false);
    connect({
      onConnected: () => router.refresh(),
      onGaveUp: () => setGaveUp(true),
      onError: () => setConnectFailed(true),
    });
  };

  const handleCheckNow = () => {
    setChecked(true);
    void checkNow({
      onConnected: () => router.refresh(),
      onError: () => {
        setConnectFailed(true);
        setGaveUp(false);
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-white px-5 py-10 sm:px-8">
      <div className="my-auto w-full max-w-[560px] text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
          <GithubMark className="h-7 w-7" />
        </div>
        <span className="mt-5 inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-500">
          Your code. Connected.
        </span>
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">
          Connect your GitHub repositories
        </h1>
        <p className="mx-auto mt-3 max-w-[440px] text-[13px] leading-relaxed text-zinc-500">
          {username ? `Hi ${username}. ` : ''}Turn your codebase into a
          searchable knowledge base. Ask questions, explore architecture, and
          generate documentation grounded in your code.
        </p>
        {(connectFailed || gaveUp) && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-[12px] leading-relaxed text-amber-800"
          >
            <p>
              {connectFailed
                ? 'We could not check your GitHub connection. Your access may already be linked — try checking again.'
                : checked
                  ? 'No repositories yet. Grant access on GitHub, then check again.'
                  : 'Approve the app on GitHub and choose the repositories you want to connect.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCheckNow}
                className="underline underline-offset-4"
              >
                Check again
              </button>
              <a
                href="https://github.com/settings/installations"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Manage app access
              </a>
            </div>
          </div>
        )}
        {connecting ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p role="status" className="text-[13px] font-medium">
              Waiting for GitHub…
            </p>
            <p className="mt-2 text-[12px] text-zinc-500">
              Approve the app in the tab that opened, then check your
              connection.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleCheckNow}
                className="workspace-button workspace-button--primary"
              >
                Check now
              </button>
              <button
                type="button"
                onClick={cancel}
                className="workspace-button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={!installUrl}
            aria-label="Connect GitHub App"
            className="workspace-button workspace-button--primary mx-auto mt-6 h-11 px-6"
          >
            <GithubMark className="h-4 w-4" />
            {installUrl ? 'Connect GitHub App' : 'GitHub App not configured'}
            <ArrowRight size={14} />
          </button>
        )}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck size={13} />
          Read-only access. Your code is never modified.
        </p>
        <div className="mt-9 grid gap-3 text-left sm:grid-cols-3">
          {[
            {
              icon: GitBranch,
              title: 'Understand your code',
              description: 'Explore files, symbols, and their connections.',
            },
            {
              icon: MessageSquare,
              title: 'Ask with context',
              description: 'Get answers backed by source evidence.',
            },
            {
              icon: BookOpen,
              title: 'Keep knowledge close',
              description: 'Generate a wiki from your repository.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4"
            >
              <Icon size={17} className="mb-3 text-zinc-500" />
              <h2 className="text-[12px] font-medium">{title}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

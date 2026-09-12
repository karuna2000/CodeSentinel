'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Database,
  FileText,
  MessageCircle,
  Network,
  Plus,
  Send,
} from 'lucide-react';
import { GithubMark } from '@/features/auth/components/github-mark';
import CodeSentinelShell from '@/features/shell/components/code-sentinel-shell';

interface EmptyChatViewProps {
  username?: string;
  installUrl?: string;
  onConnectGitHub?: () => void | Promise<void>;
  onBrowseDemo?: () => void;
}

const gettingStarted = [
  {
    step: 1,
    title: 'Connect GitHub App',
    description: 'Link your GitHub account securely with read-only access.',
    active: true,
  },
  {
    step: 2,
    title: 'Choose repositories',
    description: 'Select the repositories you want CodeSentinel to understand.',
  },
  {
    step: 3,
    title: 'Start indexing',
    description: "We'll analyze your code and build its knowledge graph.",
  },
  {
    step: 4,
    title: 'Chat with your codebase',
    description: 'Ask questions, explore architecture, and generate documentation.',
  },
];

const capabilities = [
  {
    title: 'Ask about code',
    description:
      'Find functions, understand logic, and get clear answers from your codebase.',
    icon: MessageCircle,
    iconClass: 'bg-[#E1F2E5] text-[#0B543D]',
  },
  {
    title: 'Explore architecture',
    description:
      'Visualize your system design, dependencies, and relationships across your code.',
    icon: Network,
    iconClass: 'bg-[#DCE9E2] text-[#205A4A]',
  },
  {
    title: 'Generate wiki',
    description:
      'Create documentation from your code, including APIs, modules, and examples.',
    icon: FileText,
    iconClass: 'bg-[#E3EDE6] text-[#15543F]',
  },
];

const POLL_INTERVAL_MS = 5000;
const POLL_CAP = 24;

export default function EmptyChatView({
  username,
  installUrl,
  onConnectGitHub,
  onBrowseDemo,
}: EmptyChatViewProps) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const timersRef = useRef<number[]>([]);

  const displayName = (username ?? '').trim();

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearInterval(t));
    };
  }, []);

  const handleConnectGitHub = () => {
    if (onConnectGitHub) {
      void onConnectGitHub();
      return;
    }
    if (!installUrl) return;
    setConnecting(true);
    window.open(installUrl, '_blank', 'noopener,noreferrer');

    let tries = 0;
    const iv = window.setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch('/api/github/repos');
        const data = (await res.json()) as { repositories?: unknown };
        if (Array.isArray(data.repositories) && data.repositories.length > 0) {
          window.clearInterval(iv);
          setConnecting(false);
          router.replace('/dashboard/repos');
          return;
        }
      } catch {
        // keep polling until the cap is reached
      }
      if (tries >= POLL_CAP) {
        window.clearInterval(iv);
        setConnecting(false);
      }
    }, POLL_INTERVAL_MS);
    timersRef.current.push(iv);
  };

  const handleBrowseDemo = () => {
    if (onBrowseDemo) {
      onBrowseDemo();
      return;
    }
    router.push('/dashboard/repos');
  };

  return (
    <CodeSentinelShell active="Chat" username={displayName} frame={false}>
      <main className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_330px] gap-5 p-4 lg:p-6">
        <section className="min-w-0">
          <div className="mb-4">
            <span className="text-[13px] font-medium text-[var(--brand-muted)]">Chat</span>

            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.035em] text-[var(--brand-navy)]">
              Start chatting with your codebase
            </h1>

            <p className="mt-1 max-w-[820px] text-[15px] leading-6 text-[var(--brand-muted)]">
              Connect a GitHub repository to unlock AI-powered search, get
              instant answers, explore architecture, and generate
              documentation from your code.
            </p>
          </div>

          <HeroEmptyState
            onConnectGitHub={handleConnectGitHub}
            onBrowseDemo={handleBrowseDemo}
            connecting={connecting}
          />

          <Capabilities />

          <DisabledComposer />
        </section>

        <aside className="space-y-4">
          <GettingStartedCard />
          <SourcesCard />
        </aside>
      </main>
    </CodeSentinelShell>
  );
}

function HeroEmptyState({
  onConnectGitHub,
  onBrowseDemo,
  connecting,
}: {
  onConnectGitHub: () => void;
  onBrowseDemo: () => void;
  connecting: boolean;
}) {
  return (
<section className="rounded-2xl border border-[#DFE3D9] bg-white px-6 py-4">
      <div className="flex flex-col items-center justify-center">
        <div className="grid w-full max-w-[760px] grid-cols-[150px_70px_160px_70px_190px] items-center">
          <RepositoryIllustration />

          <ArrowBridge />

          <CodeSentinelIllustration />

          <ArrowBridge />

          <div className="space-y-2.5">
            <MiniCapability icon={MessageCircle} title="Chat" subtitle="Get answers" />
            <MiniCapability icon={Network} title="Architecture" subtitle="Visualize structure" />
            <MiniCapability icon={FileText} title="Wiki" subtitle="Generate docs" />
          </div>
        </div>

        <button
          type="button"
          onClick={onConnectGitHub}
          disabled={connecting}
          className="mt-4 flex h-11 w-[300px] cursor-pointer items-center justify-center gap-3 rounded-lg bg-[var(--brand-green)] font-semibold text-white shadow-sm transition hover:bg-[var(--brand-green-soft)] disabled:opacity-60"
        >
          {connecting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <GithubMark className="h-5 w-5" />
          )}
          {connecting ? 'Waiting for GitHub…' : 'Connect GitHub App'}
          {!connecting && <ArrowRight className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onBrowseDemo}
          className="mt-2 flex h-10 w-[300px] cursor-pointer items-center justify-center gap-3 rounded-lg border border-[#C9D2C8] bg-white font-medium text-[var(--brand-navy)] transition hover:bg-[#F7F8F2]"
        >
          <BookOpen className="h-4 w-4 text-[var(--brand-green)]" />
          Browse demo workspace
        </button>

        <p className="mt-2 text-[13px] text-[var(--brand-muted)]">
          Explore a pre-indexed example to see CodeSentinel in action.
        </p>
      </div>
    </section>
  );
}

function RepositoryIllustration() {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-[#F1F3EE]">
        <GithubMark className="h-[52px] w-[52px] text-[var(--brand-navy)]" />
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-[var(--brand-navy)]">Your Repository</h3>
      <p className="mt-0.5 text-xs text-[var(--brand-muted)]">Connect GitHub</p>
    </div>
  );
}

function CodeSentinelIllustration() {
  return (
    <div className="text-center">
      <div className="relative mx-auto h-[94px] w-[134px]">
        <div className="absolute left-6 top-1 h-[78px] w-[84px] rotate-[-4deg] rounded-2xl border border-[var(--brand-step)]/30 bg-[#E3F2E6]/40" />

        <div className="absolute left-10 top-0 grid h-[86px] w-[86px] place-items-center rounded-2xl border border-[var(--brand-green)]/40 bg-[#CBE6D3]/60 shadow-lg shadow-[var(--brand-green)]/10">
          <Logo />
        </div>
      </div>

      <h3 className="mt-2 text-[15px] font-semibold text-[var(--brand-navy)]">CodeSentinel</h3>
      <p className="mt-0.5 text-xs text-[var(--brand-muted)]">Understand your code</p>
    </div>
  );
}

function ArrowBridge() {
  return (
    <div className="flex items-center justify-center text-[var(--brand-green)]">
      <div className="w-12 border-t-2 border-dashed border-[var(--brand-step)]/50" />
      <ArrowRight className="ml-1 h-5 w-5" />
    </div>
  );
}

function MiniCapability({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#E2E9E4] bg-white px-2.5 py-1.5 shadow-sm">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E1F2E5] text-[var(--brand-green)]">
        <Icon className="h-4 w-4" />
      </span>

      <div>
        <div className="text-sm font-semibold text-[var(--brand-navy)]">{title}</div>
        <div className="text-[11px] text-[var(--brand-muted)]">{subtitle}</div>
      </div>
    </div>
  );
}

function Capabilities() {
  return (
    <section className="mt-3 grid grid-cols-3 gap-3">
      {capabilities.map((item) => {
        const Icon = item.icon;

        return (
          <article key={item.title} className="rounded-xl border border-[#DFE3D9] bg-white p-4">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${item.iconClass}`}>
              <Icon className="h-5 w-5" />
            </span>

            <h3 className="mt-3 text-[15px] font-semibold text-[var(--brand-navy)]">{item.title}</h3>

            <p className="mt-1.5 text-[13px] leading-5 text-[var(--brand-muted)]">{item.description}</p>
          </article>
        );
      })}
    </section>
  );
}

function DisabledComposer() {
  return (
    <section className="mt-3 rounded-xl border border-[#DFE3D9] bg-white p-3">
      <textarea
        disabled
        rows={1}
        placeholder="Connect a repository to start asking questions about your codebase..."
        className="w-full resize-none border-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-[var(--brand-muted)]"
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-lg border border-[#DFE3D9] text-[var(--brand-muted)]"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#DFE3D9] px-3 text-xs text-[var(--brand-muted)]"
          >
            Repo: Not connected
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-[#DFE3D9] px-3 text-xs text-[var(--brand-muted)]"
          >
            Add context
          </button>
        </div>

        <button
          type="button"
          disabled
          className="grid h-11 w-12 cursor-not-allowed place-items-center rounded-lg bg-[#DDE2E4] text-white"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function GettingStartedCard() {
  return (
    <section className="rounded-2xl border border-[#DFE3D9] bg-white p-4">
      <h2 className="text-lg font-bold text-[var(--brand-navy)]">Get started in 4 steps</h2>

      <div className="mt-3">
        {gettingStarted.map((item, index) => (
          <div key={item.step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={[
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                  item.active ? 'bg-[#E1F2E5] text-[var(--brand-green)]' : 'bg-[#EDEFE9] text-[#4B5750]',
                ].join(' ')}
              >
                {item.step}
              </span>

              {index < gettingStarted.length - 1 && (
                <div className="h-[48px] w-[3px] bg-[#E4E8E6]" />
              )}
            </div>

            <div className="pb-4">
              <h3 className="text-sm font-semibold text-[var(--brand-navy)]">{item.title}</h3>

              <p className="mt-0.5 text-[13px] leading-4 text-[var(--brand-muted)]">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 rounded-xl bg-[#E8FAF4] p-3">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-[var(--brand-green)]" />

          <div>
            <div className="text-sm font-semibold text-[#10223D]">Need help?</div>

            <button type="button" className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-[var(--brand-green)]">
              Check out our quickstart guide
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SourcesCard() {
  return (
    <section className="rounded-2xl border border-[#DFE3D9] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--brand-navy)]">Sources (0)</h2>

        <button type="button" className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--brand-green)]">
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-[140px] flex-col items-center justify-center">
        <div className="relative">
          <FileText className="h-12 w-12 fill-[#E9ECE8] text-[#D3D8D1]" />
        </div>

        <h3 className="mt-2 text-[15px] font-semibold text-[var(--brand-navy)]">No sources yet</h3>

        <p className="mt-1 max-w-[230px] text-center text-[13px] leading-4 text-[var(--brand-muted)]">
          Source-backed answers will appear here after you connect and index a repository.
        </p>
      </div>

      <div className="rounded-xl bg-[#E8FAF4] px-3 py-2">
        <div className="flex items-center gap-3">
          <Database className="h-4 w-4 text-[var(--brand-green)]" />

          <span className="text-[13px] text-[var(--brand-muted)]">Connect a repository to get started.</span>
        </div>
      </div>
    </section>
  );
}

function Logo() {
  return (
    <div className="relative grid h-8 w-8 place-items-center">
      <span className="absolute h-6 w-6 rotate-45 rounded-[4px] border-[3px] border-[var(--brand-green)]" />
      <span className="absolute h-2 w-2 rounded-full bg-[var(--brand-green)]" />
    </div>
  );
}
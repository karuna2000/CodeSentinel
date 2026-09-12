'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Database,
  GitBranch,
  MessageSquare,
  Network,
} from 'lucide-react';
import { GithubMark } from '@/features/auth/components/github-mark';
import CodeSentinelShell from '@/features/shell/components/code-sentinel-shell';

interface GitHubConnectScreenProps {
  username?: string;
  installUrl?: string;
  onConnect?: () => void | Promise<void>;
}

const POLL_INTERVAL_MS = 5000;
const POLL_CAP = 24;

export default function GitHubConnectScreen({
  username,
  installUrl,
  onConnect,
}: GitHubConnectScreenProps) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const timersRef = useRef<number[]>([]);

  const displayName = (username ?? '').trim();

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearInterval(t));
    };
  }, []);

  const startPolling = (skipOpen: boolean) => {
    if (!installUrl && !skipOpen) return;
    setWaiting(true);
    setGaveUp(false);

    if (!skipOpen && installUrl) {
      window.open(installUrl, '_blank', 'noopener,noreferrer');
    }

    let tries = 0;
    const iv = window.setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch('/api/github/repos');
        const data = (await res.json()) as { repositories?: unknown };
        if (Array.isArray(data.repositories) && data.repositories.length > 0) {
          window.clearInterval(iv);
          setWaiting(false);
          router.replace('/dashboard/repos');
          return;
        }
      } catch {
        // keep polling until the cap is reached
      }
      if (tries >= POLL_CAP) {
        window.clearInterval(iv);
        setWaiting(false);
        setGaveUp(true);
      }
    }, POLL_INTERVAL_MS);
    timersRef.current.push(iv);
  };

  const handleConnect = () => {
    if (onConnect) {
      void onConnect();
      return;
    }
    startPolling(false);
  };

  return (
    <CodeSentinelShell active="Repositories" username={displayName}>
      <div className="connect-grid">
        <section className="px-7 pb-10 pt-8 sm:px-12 lg:px-14 lg:pt-10">
          <OnboardingSteps />

          <div className="mt-14 max-w-[570px]">
            <h1 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--brand-navy)] sm:text-[38px]">
              Connect your GitHub repositories
            </h1>

            <p className="mt-4 max-w-[520px] text-[17px] leading-7 text-[var(--brand-muted)]">
              CodeSentinel uses a GitHub App to securely access the
              repositories you choose.
            </p>

            <p className="mt-4 max-w-[520px] text-[17px] leading-7 text-[var(--brand-muted)]">
              We only request the permissions needed to understand your code
              and keep its knowledge up to date.
            </p>

            <PermissionsCard />

            <button
              type="button"
              onClick={handleConnect}
              disabled={waiting}
              className="group mt-5 flex h-[72px] w-full cursor-pointer items-center rounded-2xl bg-[var(--brand-green)] px-7 text-left text-white shadow-sm transition duration-200 hover:bg-[var(--brand-green-soft)] hover:shadow-md disabled:opacity-80"
            >
              <GithubMark className="h-7 w-7 shrink-0" />

              <span className="flex-1 text-center text-[18px] font-semibold">
                {waiting ? 'Waiting for GitHub…' : 'Connect GitHub App'}
              </span>

              {waiting ? (
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <ArrowRight className="h-6 w-6 transition-transform duration-200 group-hover:translate-x-1" />
              )}
            </button>

            <p className="mt-5 max-w-[500px] text-[14px] leading-6 text-[var(--brand-muted)]">
              {gaveUp
                ? 'Haven’t connected yet? When you’re done on GitHub, click “Connect GitHub App” again.'
                : 'You’ll be taken to GitHub to choose which repositories CodeSentinel can access.'}
            </p>

            {!waiting && (
              <button
                type="button"
                onClick={() => startPolling(true)}
                className="mt-3 cursor-pointer text-[14px] font-medium text-[var(--brand-muted)] underline decoration-[var(--brand-muted)] underline-offset-4 transition hover:text-[var(--brand-navy)]"
              >
                Already connected? Check for repositories →
              </button>
            )}
          </div>
        </section>

        <KnowledgePanel />
      </div>
    </CodeSentinelShell>
  );
}

function OnboardingSteps() {
  return (
    <div className="flex max-w-[520px] items-start">
      <Step number={1} label="Connect GitHub" active />
      <StepLine />
      <Step number={2} label="Select repositories" />
      <StepLine />
      <Step number={3} label="Start indexing" />
    </div>
  );
}

function Step({
  number,
  label,
  active = false,
}: {
  number: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex min-w-[120px] flex-col items-center gap-3">
      <span
        className={[
          'grid h-10 w-10 place-items-center rounded-full text-sm font-semibold',
          active
            ? 'bg-[var(--brand-step)] text-white'
            : 'bg-[#E7E9E3] text-[#53605C]',
        ].join(' ')}
      >
        {number}
      </span>

      <span
        className={[
          'whitespace-nowrap text-center text-[14px]',
          active
            ? 'font-semibold text-[#0C563D]'
            : 'font-medium text-[#747B82]',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  );
}

function StepLine() {
  return (
    <div className="mt-[19px] hidden h-px min-w-8 flex-1 bg-[#B9C0B9] sm:block" />
  );
}

function PermissionsCard() {
  return (
    <div className="mt-6 overflow-hidden rounded-[18px] border border-[#CFDCCF] bg-white/45 px-6 sm:px-7">
      <PermissionRow
        icon={<Code2 className="h-7 w-7" />}
        title="Repository contents"
        description="Read files and source code"
      />
      <Divider />
      <PermissionRow
        icon={<Database className="h-7 w-7" />}
        title="Repository metadata"
        description="Understand branches and commits"
      />
      <Divider />
      <PermissionRow
        icon={<GitBranch className="h-7 w-7" />}
        title="Pull requests"
        description="Understand changes and evolution"
      />
    </div>
  );
}

function PermissionRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-5 py-5">
      <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-2xl bg-[#E1F2E5] text-[#0B543D]">
        {icon}
      </span>

      <div>
        <h3 className="text-[16px] font-semibold text-[#111C3F]">{title}</h3>
        <p className="mt-1 text-[14px] text-[#687284]">{description}</p>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[#D8E0D8]" />;
}

function KnowledgePanel() {
  return (
    <section className="relative overflow-hidden px-7 pb-8 pt-10 sm:px-12 lg:border-l lg:border-[#EEEDE4] lg:px-14">
      <div className="relative z-10 max-w-[610px]">
        <span className="font-serif text-[52px] font-bold leading-none text-[var(--brand-accent)]">
          “
        </span>

        <h2 className="-mt-2 max-w-[600px] text-[29px] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--brand-navy)] sm:text-[34px]">
          From repository to living knowledge
        </h2>

        <p className="mt-5 max-w-[590px] text-[17px] leading-7 text-[var(--brand-muted)]">
          CodeSentinel maps symbols, relationships and source evidence so your
          team can ask questions, explore architecture and keep documentation
          synchronized with the code.
        </p>

        <span className="mt-1 block text-right font-serif text-[52px] font-bold leading-none text-[var(--brand-accent)]">
          ”
        </span>
      </div>

      <KnowledgeIllustration />

      <IllustrationLandscape />
    </section>
  );
}

function KnowledgeIllustration() {
  return (
    <div className="connect-illust relative z-10 mt-6 flex items-center justify-center">
      <div className="relative mx-auto h-[390px] w-full max-w-[650px]">
        <RepositoryNode />
        <Connector className="left-[32%] top-[48%] w-[15%]" />
        <KnowledgeGraphNode />
        <FlowConnector className="left-[64%] top-[27%]" width={90} rotate={-24} />
        <FlowConnector className="left-[65%] top-[49%]" width={75} rotate={0} />
        <FlowConnector className="left-[64%] top-[68%]" width={90} rotate={22} />

        <OutputCard
          className="right-0 top-[4%]"
          icon={<MessageSquare className="h-7 w-7" />}
          title="Ask about your code"
          description="Get accurate answers with source references"
        />
        <OutputCard
          className="right-0 top-[38%]"
          icon={<BookOpen className="h-7 w-7" />}
          title="Documentation & Wikis"
          description="Automatically generated and always up to date"
        />
        <OutputCard
          className="right-0 top-[72%]"
          icon={<Network className="h-7 w-7" />}
          title="Architecture Graphs"
          description="Explore structure, dependencies and design"
        />
      </div>
    </div>
  );
}

function RepositoryNode() {
  return (
    <div className="absolute left-0 top-[32%] w-[190px]">
      <div className="relative mx-auto h-[145px] w-[145px]">
        <div className="absolute inset-x-[24px] top-0 h-[68px] rotate-[-1deg] rounded-[4px] border-[3px] border-[var(--brand-illustration)] bg-[var(--brand-panel)]" />

        <div className="absolute bottom-0 left-[10px] h-[108px] w-[63px] skew-y-[28deg] rounded-[3px] border-[3px] border-[var(--brand-illustration)] bg-[var(--brand-panel)]" />

        <div className="absolute bottom-0 right-[10px] h-[108px] w-[63px] -skew-y-[28deg] rounded-[3px] border-[3px] border-[var(--brand-illustration)] bg-[var(--brand-panel)]" />

        <div className="absolute bottom-[33px] left-[28px] z-10 grid h-12 w-12 place-items-center rounded-full bg-[#111A25] text-white">
          <GithubMark className="h-8 w-8" />
        </div>

        <div className="absolute bottom-[33px] right-[28px] z-10 space-y-2">
          <span className="block h-[4px] w-8 rounded-full bg-[#EB9F87]" />
          <span className="block h-[4px] w-10 rounded-full bg-[#87A6AB]" />
          <span className="block h-[4px] w-8 rounded-full bg-[#87A6AB]" />
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="font-semibold text-[#13213D]">GitHub Repository</p>
        <p className="mt-1 text-[13px] leading-5 text-[#697285]">
          Your code, your source
          <br />
          of truth
        </p>
      </div>
    </div>
  );
}

function KnowledgeGraphNode() {
  return (
    <div className="absolute left-[41%] top-[28%] w-[175px]">
      <div className="mx-auto grid h-[140px] w-[140px] place-items-center rounded-full border-[4px] border-[var(--brand-illustration)] bg-[var(--brand-panel)]">
        <div className="relative h-[84px] w-[84px]">
          <GraphLine className="left-[17px] top-[22px] w-[54px] rotate-[-48deg]" />
          <GraphLine className="left-[39px] top-[21px] w-[49px] rotate-[48deg]" />
          <GraphLine className="left-[18px] top-[52px] w-[51px] rotate-[43deg]" />
          <GraphLine className="left-[41px] top-[53px] w-[46px] rotate-[-45deg]" />

          <GraphDot className="left-0 top-[32px] bg-[#9EC8C8]" />
          <GraphDot className="left-[33px] top-0 bg-[#C1DFC1]" />
          <GraphDot className="right-0 top-[32px] bg-[#F2B195]" />
          <GraphDot className="bottom-0 left-[33px] bg-[#9FD1A8]" />
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="font-semibold leading-5 text-[#13213D]">
          CodeSentinel
          <br />
          Knowledge Graph
        </p>

        <p className="mt-1 text-[13px] leading-5 text-[#697285]">
          Symbols, relationships
          <br />
          and source evidence
        </p>
      </div>
    </div>
  );
}

function GraphLine({ className }: { className: string }) {
  return (
    <span
      className={`absolute h-[3px] origin-left rounded-full bg-[var(--brand-illustration)] ${className}`}
    />
  );
}

function GraphDot({ className }: { className: string }) {
  return (
    <span
      className={`absolute z-10 h-[24px] w-[24px] rounded-full border-[3px] border-[var(--brand-illustration)] ${className}`}
    />
  );
}

function Connector({ className }: { className: string }) {
  return (
    <div
      className={`absolute h-[4px] rounded-full bg-[var(--brand-illustration)] ${className}`}
    >
      <span className="absolute -left-2 -top-[6px] h-4 w-4 rounded-full border-[3px] border-[var(--brand-illustration)] bg-[#9EC7AC]" />
      <span className="absolute -right-2 -top-[6px] h-4 w-4 rounded-full border-[3px] border-[var(--brand-illustration)] bg-[#9EC7AC]" />
    </div>
  );
}

function FlowConnector({
  className,
  width,
  rotate,
}: {
  className: string;
  width: number;
  rotate: number;
}) {
  return (
    <div
      className={`absolute h-[4px] origin-left rounded-full bg-[var(--brand-illustration)] ${className}`}
      style={{
        width,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <span className="absolute -right-2 -top-[6px] h-4 w-4 rounded-full border-[3px] border-[var(--brand-illustration)] bg-[#9EC7AC]" />
    </div>
  );
}

function OutputCard({
  className,
  icon,
  title,
  description,
}: {
  className: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`absolute flex w-[245px] items-center gap-4 rounded-xl border-[3px] border-[var(--brand-illustration)] bg-[var(--brand-panel)] px-4 py-4 shadow-[0_2px_0_rgba(20,63,73,0.03)] ${className}`}
    >
      <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-lg bg-[#E5F2E8] text-[#164B49]">
        {icon}
      </span>

      <div>
        <h3 className="text-[14px] font-bold leading-5 text-[#101B3C]">
          {title}
        </h3>
        <p className="mt-1 text-[12px] leading-4 text-[#677083]">
          {description}
        </p>
      </div>
    </div>
  );
}

function IllustrationLandscape() {
  return (
    <>
      <div className="pointer-events-none absolute -bottom-[105px] left-[4%] h-[220px] w-[220px] rounded-full bg-[#E3F2E4]" />

      <div className="pointer-events-none absolute -bottom-[125px] left-[30%] h-[190px] w-[190px] rounded-full bg-[#D8EEDC]" />

      <div className="pointer-events-none absolute -bottom-[80px] right-[-60px] h-[270px] w-[270px] rounded-full bg-[#D7EFDC]" />

      <Tree className="bottom-[-4px] left-[2%]" />
      <Tree className="bottom-[-8px] right-[2%]" />
    </>
  );
}

function Tree({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute z-10 h-[150px] w-[90px] ${className}`}
    >
      <div className="absolute left-[9px] top-0 h-[115px] w-[72px] rounded-[50%] border-[4px] border-[var(--brand-illustration)] bg-[var(--brand-panel)]" />

      <div className="absolute bottom-0 left-1/2 h-[80px] w-[4px] -translate-x-1/2 bg-[var(--brand-illustration)]" />

      <div className="absolute bottom-[42px] left-[27px] h-[4px] w-[28px] rotate-45 bg-[var(--brand-illustration)]" />

      <div className="absolute bottom-[42px] right-[27px] h-[4px] w-[28px] -rotate-45 bg-[var(--brand-illustration)]" />
    </div>
  );
}
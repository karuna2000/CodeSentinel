import type { ReactNode } from 'react';
import { BookOpen, ChevronDown, Database, MessageCircle, Network, Settings } from 'lucide-react';

const navigation = [
  { label: 'Repositories', icon: Database, href: '/dashboard/repos' },
  { label: 'Chat', icon: MessageCircle, href: '/dashboard' },
  { label: 'Architecture', icon: Network, href: '/dashboard' },
  { label: 'Wiki', icon: BookOpen, href: '/dashboard' },
  { label: 'Settings', icon: Settings, href: '/dashboard' },
];

type AppShellProps = {
  children: ReactNode;
  active?: string;
  username?: string;
  frame?: boolean;
};

export default function CodeSentinelShell({
  children,
  active = 'Repositories',
  username = '@karunayadav',
  frame = true,
}: AppShellProps) {
  const clean = username.replace(/^@/, '').trim();
  const initial = (clean.charAt(0) || 'K').toUpperCase();

  return (
    <main
      className={[
        'relative h-dvh overflow-hidden font-sans',
        frame ? 'bg-[var(--brand-bg)] p-5 lg:p-12' : 'bg-[var(--brand-cream)]',
      ].join(' ')}
    >
      {frame && <BackgroundDecoration />}

      <section
        className={[
          'relative z-10 mx-auto flex h-[calc(100dvh-40px)] flex-col overflow-hidden lg:h-[calc(100dvh-96px)]',
          frame
            ? 'max-w-[1500px] rounded-[var(--radius-shell)] border border-white/70 bg-[var(--brand-cream)] shadow-[0_30px_80px_rgba(0,0,0,0.08)]'
            : 'max-w-none',
        ].join(' ')}
      >
        <header
          className="
            flex h-16 shrink-0
            items-center justify-between
            border-b border-[#DFE3D9]
            px-5 sm:px-6 lg:px-8
          "
        >
          <CodeSentinelLogo />

          <div className="flex items-center gap-4 sm:gap-5">
            <nav className="hidden items-center gap-1 lg:flex">
              {navigation.map((item) => {
                const Icon = item.icon;
                const selected = active === item.label;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={[
                      'flex items-center gap-2 rounded-lg px-3 py-2',
                      'text-sm font-medium transition',
                      selected
                        ? 'bg-[#E1F2E5] text-[var(--brand-green)]'
                        : 'text-[var(--brand-muted)] hover:bg-[#F1F2E8] hover:text-[var(--brand-navy)]',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="h-6 w-px bg-[#D9DED5]" />

            <button type="button" className="flex cursor-pointer items-center gap-2.5">
              <span
                className={[
                  'grid h-9 w-9 place-items-center',
                  'rounded-full bg-[var(--brand-step)]',
                  'text-sm font-semibold text-white',
                ].join(' ')}
              >
                {initial}
              </span>

              <span className="hidden text-sm font-semibold text-[var(--brand-navy)] sm:block">
                {username}
              </span>

              <ChevronDown className="h-4 w-4 text-[var(--brand-muted)]" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </main>
  );
}

function CodeSentinelLogo() {
  return (
    <a href="/dashboard" className="flex items-center gap-3">
      <div className="relative grid h-9 w-9 place-items-center">
        <span className="absolute h-6 w-6 rotate-45 rounded-[4px] border-[3px] border-[var(--brand-green)]" />
        <span className="absolute h-2 w-2 rounded-full bg-[var(--brand-green)]" />
      </div>

      <span className="text-[19px] font-bold tracking-[-0.025em] text-[var(--brand-navy-2)]">
        CodeSentinel
      </span>
    </a>
  );
}

function BackgroundDecoration() {
  return (
    <>
      <div className="pointer-events-none absolute -bottom-[210px] left-[15%] h-[400px] w-[260px] rotate-[-14deg] border-[5px] border-white/[0.055]" />
      <div className="pointer-events-none absolute -bottom-[220px] left-[38%] h-[420px] w-[240px] rotate-[12deg] border-[5px] border-white/[0.045]" />
      <div className="pointer-events-none absolute -bottom-[190px] right-[16%] h-[390px] w-[250px] rotate-[-8deg] border-[5px] border-white/[0.05]" />
    </>
  );
}
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import OnboardingScreen from '@/features/connect/components/onboarding-screen';
import { signOut } from 'next-auth/react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { GithubMark } from '@/features/auth/components/github-mark';
import { useGitHubConnect } from '@/features/connect/hooks/use-github-connect';
import { IndexPrompt } from '@/features/chat/components/index-prompt';
import { IndexWikiWorkflow } from './index-wiki-workflow';
import { GhostButton } from './buttons';

export type WikiJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface WorkspaceRepo {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string | null;
  fileCount: number;
  readmeContent: string | null;
  isIndexed: boolean;
  lastSynced: string | null;
  commitSha: string | null;
  symbolCount: number;
  edgeCount: number;
  wikiStatus: WikiJobStatus | null;
  wikiProgress: number | null;
  wikiStep: string | null;
  wikiPages: number | null;
  diagram: boolean | null;
}

interface WorkspaceViewProps {
  initialRepositories: WorkspaceRepo[];
  installUrl?: string;
  username?: string;
  children?: ReactNode;
  databaseUnavailable?: boolean;
}

interface Toast {
  text: string;
  type: 'success' | 'error';
}

type RawRepo = {
  id: string;
  name: string;
  owner: string;
  description?: string | null;
  language?: string | null;
  stars?: number;
  default_branch?: string | null;
  file_count?: number;
  is_indexed?: boolean;
  last_synced?: string | null;
};

function fromRawRepo(raw: RawRepo): WorkspaceRepo {
  return {
    id: raw.id,
    owner: raw.owner,
    name: raw.name,
    description: raw.description ?? null,
    language: raw.language ?? null,
    stars: raw.stars ?? 0,
    defaultBranch: raw.default_branch ?? null,
    fileCount: raw.file_count ?? 0,
    readmeContent: null,
    isIndexed: Boolean(raw.is_indexed),
    lastSynced: raw.last_synced ?? null,
    commitSha: null,
    symbolCount: 0,
    edgeCount: 0,
    wikiStatus: null,
    wikiProgress: null,
    wikiStep: null,
    wikiPages: null,
    diagram: null,
  };
}

function formatLastSynced(iso: string | null): string {
  if (!iso) return 'Not synced';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Synced ${days}d ago`;
  return `Synced ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function initialsOf(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .map((p) => p[0])
      .slice(0, 2)
      .join('') || 'U'
  ).toUpperCase();
}

export default function WorkspaceView({
  initialRepositories,
  installUrl,
  username,
  children,
  databaseUnavailable = false,
}: WorkspaceViewProps) {
  const [repositories, setRepositories] =
    useState<WorkspaceRepo[]>(initialRepositories);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRepositories.find((r) => r.isIndexed)?.id ??
      initialRepositories[0]?.id ??
      null,
  );
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ repoId?: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previousInitial, setPreviousInitial] = useState(initialRepositories);
  if (previousInitial !== initialRepositories) {
    setPreviousInitial(initialRepositories);
    setRepositories(initialRepositories);
  }
  const activeTab = pathname.endsWith('/wiki')
    ? 'wiki'
    : pathname.endsWith('/chat')
      ? 'chat'
      : 'overview';
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkArmed, setBulkArmed] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const bulkArmedTimerRef = useRef<number | null>(null);
  const { connecting, connect, cancel, checkNow } =
    useGitHubConnect(installUrl);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: '/auth/signin' });
  };

  const selected =
    repositories.find((r) => r.id === (params.repoId ?? selectedId)) ??
    repositories[0] ??
    null;

  const selectRepository = (repo: WorkspaceRepo) => {
    setSelectedId(repo.id);
    setSidebarOpen(false);
    if (params.repoId) {
      router.push(
        repo.isIndexed
          ? `/dashboard/repos/${repo.id}/${activeTab === 'chat' ? 'chat' : 'wiki'}`
          : '/dashboard',
      );
    }
  };

  const filteredRepos = repositories.filter((repo) => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return true;
    return (
      repo.name.toLowerCase().includes(q) ||
      repo.owner.toLowerCase().includes(q) ||
      (repo.description ?? '').toLowerCase().includes(q)
    );
  });

  const allVisibleChecked =
    filteredRepos.length > 0 &&
    filteredRepos.every((r) => selectedIds.has(r.id));

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const refreshRepos = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/github/repos', { method: 'POST' });
      const data = (await res.json()) as {
        repositories?: RawRepo[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.repositories)) {
        throw new Error(data.error || 'Failed to refresh repositories');
      }
      const mapped = data.repositories.map(fromRawRepo);
      if (params.repoId && !mapped.some((repo) => repo.id === params.repoId))
        router.push('/dashboard');
      setRepositories((previous) =>
        mapped.map((repo) => {
          const existing = previous.find((item) => item.id === repo.id);
          return existing
            ? {
                ...existing,
                owner: repo.owner,
                name: repo.name,
                description: repo.description,
                language: repo.language,
                stars: repo.stars,
                defaultBranch: repo.defaultBranch,
                fileCount: repo.fileCount,
                isIndexed: repo.isIndexed,
                lastSynced: repo.lastSynced,
              }
            : repo;
        }),
      );
      setSelectedId((prev) =>
        prev && mapped.some((r) => r.id === prev)
          ? prev
          : (mapped.find((r) => r.isIndexed)?.id ?? mapped[0]?.id ?? null),
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Could not refresh repositories',
        'error',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const applyConnected = (list: RawRepo[]) => {
    const mapped = list.map(fromRawRepo);
    setRepositories(mapped);
    router.refresh();
    setSelectedId(mapped.find((r) => r.isIndexed)?.id ?? mapped[0]?.id ?? null);
    showToast(
      `GitHub connected — ${mapped.length} repositor${mapped.length === 1 ? 'y' : 'ies'} ready`,
    );
  };

  const handleConnect = () => {
    connect({
      onConnected: applyConnected,
      onGaveUp: () => {
        showToast(
          'Approve the GitHub App in the tab that opened, then refresh',
          'error',
        );
      },
      onError: () => {
        showToast(
          'We hit a snag checking GitHub — your connection may already be linked. Try again in a moment.',
          'error',
        );
      },
    });
  };

  const handleCheckNow = () => {
    let failed = false;
    void checkNow({
      onConnected: applyConnected,
      onError: () => {
        failed = true;
        showToast(
          'We hit a snag checking GitHub — your connection may already be linked. Try again in a moment.',
          'error',
        );
      },
    }).then((found) => {
      if (!found && !failed) {
        showToast(
          'Still no repositories — grant access on GitHub, then check again',
          'error',
        );
      }
    });
  };

  const handleIndexDone = (repoId: string, result: { fileCount: number }) => {
    setRepositories((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? {
              ...r,
              isIndexed: true,
              fileCount: result.fileCount,
              lastSynced: new Date().toISOString(),
            }
          : r,
      ),
    );
    showToast(`Indexed ${result.fileCount} files`);
  };

  const handleWikiDone = (
    repoId: string,
    s: { wikiPages: number; diagram: boolean },
  ) => {
    setRepositories((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? {
              ...r,
              wikiStatus: 'SUCCEEDED',
              wikiPages: s.wikiPages,
              diagram: s.diagram,
            }
          : r,
      ),
    );
    showToast(`Wiki generated — ${s.wikiPages} pages`);
  };

  const handleRemoveRepo = async (repoId: string) => {
    try {
      const res = await fetch(`/api/github/repos/${repoId}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Failed to remove repository',
        );
      }
      setRepositories((prev) => {
        const next = prev.filter((r) => r.id !== repoId);
        setSelectedId((cur) =>
          cur === repoId
            ? (next.find((r) => r.isIndexed)?.id ?? next[0]?.id ?? null)
            : cur,
        );
        return next;
      });
      if (params.repoId === repoId) router.push('/dashboard');
      showToast('Repository removed (index, wiki, and diagrams)');
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to remove repository',
        'error',
      );
    }
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => {
      if (v) {
        setSelectedIds(new Set());
        setBulkArmed(false);
      }
      return !v;
    });
  };

  const handleBulkArm = () => {
    if (selectedIds.size === 0) return;
    if (bulkArmedTimerRef.current !== null)
      window.clearTimeout(bulkArmedTimerRef.current);
    setBulkArmed(true);
    bulkArmedTimerRef.current = window.setTimeout(
      () => setBulkArmed(false),
      4000,
    );
  };

  const handleBulkRemove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const res = await fetch('/api/github/repos/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoIds: ids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Failed to remove repositories',
        );
      }
      if (params.repoId && ids.includes(params.repoId))
        router.push('/dashboard');
      const removedCount =
        typeof data.deleted === 'number' ? data.deleted : ids.length;
      setRepositories((prev) => {
        const removed = new Set(ids);
        const next = prev.filter((r) => !removed.has(r.id));
        setSelectedId((cur) =>
          cur && removed.has(cur)
            ? (next.find((r) => r.isIndexed)?.id ?? next[0]?.id ?? null)
            : cur,
        );
        return next;
      });
      setSelectedIds(new Set());
      setBulkArmed(false);
      if (removedCount > 0 && repositories.length === removedCount) {
        setSelectMode(false);
      }
      showToast(
        `Removed ${removedCount} repositor${removedCount === 1 ? 'y' : 'ies'} (index, wiki, and diagrams)`,
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Failed to remove repositories',
        'error',
      );
    }
  };

  const confirmBulkRemove = async () => {
    if (bulkRemoving) return;
    setBulkRemoving(true);
    await handleBulkRemove();
    setBulkRemoving(false);
    setBulkArmed(false);
  };

  useEffect(() => {
    return () => {
      if (bulkArmedTimerRef.current !== null)
        window.clearTimeout(bulkArmedTimerRef.current);
    };
  }, []);

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="workspace-icon-button lg:hidden"
            aria-label={
              sidebarOpen ? 'Close repositories' : 'Open repositories'
            }
            aria-expanded={sidebarOpen}
            aria-controls="repository-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white">
              C
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              CodeSentinel
            </span>
          </Link>
          <span className="ml-1 hidden rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500 sm:inline-flex">
            Workspace
          </span>
          <span className="ml-3 hidden items-center gap-2 border-l border-zinc-200 pl-4 text-[12px] text-zinc-500 xl:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${repositories.length ? 'bg-emerald-500' : 'bg-zinc-400'}`}
            />
            {repositories.length
              ? `${repositories.filter((repo) => repo.isIndexed).length} repositories indexed`
              : 'Connect GitHub to get started'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshRepos}
            disabled={refreshing}
            className="workspace-button hidden sm:inline-flex"
            aria-label="Refresh repositories from GitHub"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{' '}
            {refreshing ? 'Syncing…' : 'Sync'}
          </button>
          {menuOpen && (
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setMenuOpen(false)}
            />
          )}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="User menu"
              onClick={() => setMenuOpen(!menuOpen)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setMenuOpen(false);
              }}
              className="flex items-center gap-2.5 sm:border-l sm:border-zinc-200 sm:pl-4"
            >
              <span className="hidden text-right leading-tight sm:block">
                <span className="block max-w-40 truncate text-[12px] font-medium">
                  {username || 'Your account'}
                </span>
                <span className="text-[11px] text-zinc-500">
                  GitHub account
                </span>
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold">
                {initialsOf(username)}
              </span>
              <ChevronDown size={13} className="text-zinc-400" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="User menu"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setMenuOpen(false);
                }}
                className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl"
              >
                <p className="truncate border-b border-zinc-100 px-3 py-2 text-[12px] text-zinc-500">
                  {username || 'Signed in with GitHub'}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] text-red-700 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="workspace-body">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close repository navigation"
            className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          id="repository-sidebar"
          aria-label="Repositories"
          className={`workspace-repositories ${sidebarOpen ? 'workspace-repositories--open' : ''}`}
        >
          <div className="p-4 pb-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="workspace-eyebrow">Your repositories</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  disabled={bulkRemoving}
                  aria-label={
                    selectMode
                      ? 'Cancel repository selection'
                      : 'Select repositories'
                  }
                  aria-pressed={selectMode}
                  className="workspace-icon-button"
                >
                  {selectMode ? (
                    <CheckSquare size={13} />
                  ) : (
                    <Square size={13} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={refreshRepos}
                  disabled={refreshing}
                  aria-label="Refresh repository list"
                  className="workspace-icon-button"
                >
                  <RefreshCw
                    size={13}
                    className={refreshing ? 'animate-spin' : ''}
                  />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-2.5 text-zinc-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search repositories"
                aria-label="Search repositories"
                className="h-9 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-3 text-[12px] outline-none focus:border-zinc-400"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {filteredRepos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                selected={repo.id === selected?.id}
                onSelect={() => selectRepository(repo)}
                onRemove={handleRemoveRepo}
                selectMode={selectMode}
                checked={selectedIds.has(repo.id)}
                onCheck={() =>
                  setSelectedIds((previous) => {
                    const next = new Set(previous);
                    if (next.has(repo.id)) next.delete(repo.id);
                    else next.add(repo.id);
                    return next;
                  })
                }
              />
            ))}
            {filteredRepos.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px] leading-relaxed text-zinc-500">
                {repositories.length
                  ? 'No repositories match your search.'
                  : 'Your connected repositories will appear here.'}
              </p>
            )}
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !installUrl}
              className="mt-3 flex w-full items-start gap-2 rounded-xl border border-dashed border-zinc-300 bg-white/50 p-3 text-left hover:border-zinc-500 disabled:opacity-50"
            >
              <Plus size={15} className="mt-0.5 text-zinc-500" />
              <span>
                <span className="block text-[12px] font-medium">
                  {connecting ? 'Waiting for GitHub…' : 'Import repository'}
                </span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  Connect another GitHub repo to index
                </span>
              </span>
            </button>
            {connecting && (
              <div className="flex flex-wrap gap-2 p-2">
                <GhostButton onClick={handleCheckNow}>Check now</GhostButton>
                <GhostButton onClick={cancel}>Cancel</GhostButton>
              </div>
            )}
          </div>
          {selectMode && (
            <div className="space-y-2 border-t border-zinc-200 p-3">
              <button
                type="button"
                disabled={bulkRemoving}
                onClick={() =>
                  setSelectedIds(
                    allVisibleChecked
                      ? new Set()
                      : new Set(filteredRepos.map((repo) => repo.id)),
                  )
                }
                className="flex items-center gap-2 text-[12px]"
              >
                {allVisibleChecked ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                {allVisibleChecked
                  ? 'Clear selection'
                  : 'Select all visible repositories'}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!selectedIds.size || bulkRemoving}
                  onClick={bulkArmed ? confirmBulkRemove : handleBulkArm}
                  className="workspace-button text-red-700 disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  {bulkRemoving
                    ? 'Removing…'
                    : bulkArmed
                      ? `Confirm remove ${selectedIds.size}?`
                      : `Remove ${selectedIds.size}`}
                </button>
                <GhostButton disabled={bulkRemoving} onClick={toggleSelectMode}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          )}
          <div className="shrink-0 border-t border-zinc-200 bg-white/70 p-4">
            <div className="mb-3 flex justify-between text-[11px] text-zinc-500">
              <span>Repository index</span>
              <span className="font-mono text-zinc-700">
                {repositories
                  .reduce(
                    (total, repo) =>
                      total + (repo.isIndexed ? repo.fileCount : 0),
                    0,
                  )
                  .toLocaleString()}{' '}
                files
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <ShieldCheck size={15} />
              </span>
              <span className="text-[11px] leading-tight">
                <span className="block font-medium">
                  {repositories.length
                    ? 'GitHub repositories connected'
                    : 'Connect your GitHub App'}
                </span>
                <span className="text-zinc-500">
                  Read-only access to your code
                </span>
              </span>
            </div>
          </div>
        </aside>

        <main className="workspace-main" aria-label="Repository workspace">
          {databaseUnavailable ? (
            <DatabaseUnavailableState />
          ) : selected ? (
            <>
              <div className="workspace-repo-toolbar">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
                    <span className="hidden max-w-28 truncate text-zinc-500 sm:block">
                      {selected.owner}
                    </span>
                    <ChevronRight
                      size={14}
                      className="hidden shrink-0 text-zinc-300 sm:block"
                    />
                    <span className="truncate font-semibold">
                      {selected.name}
                    </span>
                  </div>
                  <span className="hidden md:inline-flex">
                    <StatusPill
                      tone={selected.isIndexed ? 'green' : 'muted'}
                      label={selected.isIndexed ? 'Indexed' : 'Not indexed'}
                    />
                  </span>
                  <span className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[10px] text-zinc-500 2xl:inline-flex">
                    <GitBranch size={12} />
                    {selected.defaultBranch || 'main'}
                    {selected.commitSha && (
                      <>
                        <span>·</span>
                        <GitCommitHorizontal size={12} />
                        {selected.commitSha.slice(0, 7)}
                      </>
                    )}
                  </span>
                </div>
                <nav aria-label="Repository views" className="workspace-tabs">
                  <Link
                    href="/dashboard"
                    onClick={() => setSelectedId(selected.id)}
                    aria-current={activeTab === 'overview' ? 'page' : undefined}
                    className={
                      activeTab === 'overview'
                        ? 'workspace-tab workspace-tab--active'
                        : 'workspace-tab'
                    }
                  >
                    <LayoutDashboard size={13} />
                    <span>Overview</span>
                  </Link>
                  <Link
                    href={`/dashboard/repos/${selected.id}/wiki`}
                    aria-current={activeTab === 'wiki' ? 'page' : undefined}
                    className={
                      activeTab === 'wiki'
                        ? 'workspace-tab workspace-tab--active'
                        : 'workspace-tab'
                    }
                  >
                    <BookOpen size={13} />
                    Wiki
                  </Link>
                  <Link
                    href={`/dashboard/repos/${selected.id}/chat`}
                    aria-current={activeTab === 'chat' ? 'page' : undefined}
                    className={
                      activeTab === 'chat'
                        ? 'workspace-tab workspace-tab--active'
                        : 'workspace-tab'
                    }
                  >
                    <MessageSquare size={13} />
                    Chat
                  </Link>
                </nav>
              </div>
              {params.repoId ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  {selected.isIndexed ? (
                    children
                  ) : (
                    <IndexPrompt key={selected.id} repoId={selected.id} />
                  )}
                </div>
              ) : (
                <div className="workspace-overview" key={selected.id}>
                  <div className="mx-auto w-full max-w-[900px]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="workspace-eyebrow mb-2">
                          Repository overview
                        </div>
                        <h1 className="text-[22px] font-semibold tracking-tight">
                          {selected.owner}/{selected.name}
                        </h1>
                        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-500">
                          {selected.description ||
                            'Explore the code, understand its architecture, and keep your documentation connected to the source.'}
                        </p>
                      </div>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-zinc-50">
                        <GithubMark className="h-6 w-6" />
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <GitBranch size={12} />
                        {selected.defaultBranch || 'main'}
                      </span>
                      {selected.language && <span>{selected.language}</span>}
                      <span>{formatLastSynced(selected.lastSynced)}</span>
                      {selected.commitSha && (
                        <span className="font-mono">
                          {selected.commitSha.slice(0, 7)}
                        </span>
                      )}
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <Metric value={selected.fileCount} label="Files" />
                      <Metric
                        value={selected.isIndexed ? selected.symbolCount : '—'}
                        label="Graph nodes"
                      />
                      <Metric
                        value={selected.isIndexed ? selected.edgeCount : '—'}
                        label="Connections"
                      />
                      <Metric
                        value={selected.wikiPages ?? '—'}
                        label="Wiki pages"
                      />
                      <Metric
                        value={selected.diagram ? 'Ready' : '—'}
                        label="Diagram"
                      />
                    </div>
                    <section className="mt-6 rounded-2xl border border-zinc-200 bg-[#fcfcfb] p-5 sm:p-6">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white">
                          <Database size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[14px] font-semibold">
                            {selected.isIndexed
                              ? 'Keep your repository up to date'
                              : 'Build your repository intelligence'}
                          </h2>
                          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                            Index your files and symbols, then generate a wiki
                            and architecture diagram from your code.
                          </p>
                        </div>
                        <span className="hidden sm:block">
                          <StatusPill
                            tone={workflowStatusTone(selected)}
                            label={workflowStatusLabel(selected)}
                          />
                        </span>
                      </div>
                      <div className="my-5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        {[
                          'Files',
                          'Symbols',
                          'Repository graph',
                          'Wiki & answers',
                        ].map((step, index) => (
                          <span key={step} className="flex items-center gap-2">
                            {index > 0 && <ChevronRight size={12} />}
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">
                              {step}
                            </span>
                          </span>
                        ))}
                      </div>
                      <IndexWikiWorkflow
                        repoId={selected.id}
                        indexed={selected.isIndexed}
                        onIndexDone={(result) =>
                          handleIndexDone(selected.id, result)
                        }
                        onWikiDone={(result) =>
                          handleWikiDone(selected.id, result)
                        }
                      />
                    </section>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Link
                        href={`/dashboard/repos/${selected.id}/wiki`}
                        className="workspace-feature-card"
                      >
                        <BookOpen size={19} />
                        <h2>Repository wiki</h2>
                        <p>
                          Browse generated documentation, architecture diagrams,
                          and saved insights.
                        </p>
                        <span>
                          Open wiki <ChevronRight size={13} />
                        </span>
                      </Link>
                      <Link
                        href={`/dashboard/repos/${selected.id}/chat`}
                        className="workspace-feature-card"
                      >
                        <MessageSquare size={19} />
                        <h2>Ask your codebase</h2>
                        <p>
                          Explore how your code works with answers grounded in
                          file and line evidence.
                        </p>
                        <span>
                          Open chat <ChevronRight size={13} />
                        </span>
                      </Link>
                    </div>
                    <section className="mt-6 rounded-2xl border border-zinc-200 p-5">
                      <h2 className="workspace-eyebrow flex items-center gap-2">
                        <FileCode2 size={14} />
                        Repository details
                      </h2>
                      <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
                        <Field label="Language">
                          {selected.language || '—'}
                        </Field>
                        <Field label="Default branch">
                          {selected.defaultBranch || 'main'}
                        </Field>
                        <Field label="Stars">
                          {selected.stars.toLocaleString()}
                        </Field>
                        <Field label="Last synced">
                          {formatLastSynced(selected.lastSynced)}
                        </Field>
                      </dl>
                      {selected.readmeContent && (
                        <ReadmePreview readme={selected.readmeContent} />
                      )}
                    </section>
                  </div>
                </div>
              )}
            </>
          ) : (
            <OnboardingScreen username={username} installUrl={installUrl} />
          )}
        </main>
      </div>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-[calc(100vw-40px)] rounded-xl border px-4 py-3 text-[12px] shadow-lg ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-zinc-200 bg-zinc-900 text-white'}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function DatabaseUnavailableState() {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center px-6 py-12">
      <div className="w-full max-w-[520px] rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold text-zinc-900">Database unavailable</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-amber-900/75">
          CodeSentinel could not connect to its repository database. Start the configured PostgreSQL service, then reload this page.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="workspace-button workspace-button--primary mt-5">
          <RefreshCw size={14} /> Retry connection
        </button>
      </div>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: 'green' | 'amber' | 'muted';
  label: string;
}) {
  const tones = {
    green: 'bg-[#ecfdf5] text-[#047857]',
    amber: 'bg-[#fffbeb] text-[#b45309]',
    muted: 'bg-[#f4f4f5] text-[#71717a]',
  } as const;
  const dots = {
    green: 'bg-[#18181b]',
    amber: 'bg-[#f59e0b]',
    muted: 'bg-[#a1a1aa]',
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${tones[tone]}`}
    >
      <span
        className={`h-[5px] w-[5px] rounded-full ${dots[tone]}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-4">
      <p className="text-[21px] font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#a1a1aa]">
        {label}
      </dt>
      <dd className="mt-1 truncate text-[12.5px] font-semibold text-[#18181b]">
        {children}
      </dd>
    </div>
  );
}

function ReadmePreview({ readme }: { readme: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = readme.split('\n');
  const shown = expanded ? lines : lines.slice(0, 12);
  const canExpand = lines.length > 12;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#a1a1aa]">
          README
        </span>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-semibold text-[#3f3f46] underline underline-offset-2 hover:text-[#18181b]"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 font-mono text-[11.5px] leading-[1.6] text-[#52525b]">
        {shown.join('\n')}
      </pre>
    </div>
  );
}

function workflowStatusLabel(repo: WorkspaceRepo): string {
  if (repo.wikiStatus === 'RUNNING' || repo.wikiStatus === 'PENDING')
    return 'Running';
  if (repo.wikiStatus === 'SUCCEEDED') return 'Ready';
  if (repo.wikiStatus === 'FAILED') return 'Docs failed';
  return repo.isIndexed ? 'Indexed' : 'Not indexed';
}

function workflowStatusTone(repo: WorkspaceRepo): 'green' | 'amber' | 'muted' {
  if (repo.wikiStatus === 'SUCCEEDED') return 'green';
  if (
    repo.wikiStatus === 'RUNNING' ||
    repo.wikiStatus === 'PENDING' ||
    repo.wikiStatus === 'FAILED'
  ) {
    return 'amber';
  }
  return repo.isIndexed ? 'green' : 'amber';
}

function RepoCard({
  repo,
  selected,
  onSelect,
  onRemove,
  selectMode = false,
  checked = false,
  onCheck,
}: {
  repo: WorkspaceRepo;
  selected: boolean;
  onSelect: () => void;
  onRemove: (repoId: string) => Promise<void>;
  selectMode?: boolean;
  checked?: boolean;
  onCheck?: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [removing, setRemoving] = useState(false);
  const armTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (armTimerRef.current !== null)
        window.clearTimeout(armTimerRef.current);
    };
  }, []);

  const handleArm = () => {
    if (armed && armTimerRef.current !== null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    const next = !armed;
    setArmed(next);
    if (next) {
      armTimerRef.current = window.setTimeout(() => setArmed(false), 4000);
    }
  };

  const confirmRemove = async () => {
    setRemoving(true);
    await onRemove(repo.id);
    setRemoving(false);
    setArmed(false);
  };

  return (
    <div
      className={`group rounded-xl border transition-colors ${
        selected
          ? 'border-zinc-900 bg-white shadow-sm'
          : 'border-transparent bg-transparent hover:border-zinc-200 hover:bg-white'
      }`}
    >
      <button
        type="button"
        onClick={selectMode ? onCheck : onSelect}
        aria-pressed={selectMode ? checked : selected}
        className="w-full p-3 text-left cursor-pointer"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {selectMode && (
              <span
                aria-hidden="true"
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors ${
                  checked
                    ? 'border-[#18181b] bg-[#18181b] text-white'
                    : 'border-[#d4d4d8] bg-white'
                }`}
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#18181b]">
                {repo.owner}/{repo.name}
              </p>
              <p className="mt-1 truncate text-[11px] text-zinc-500">
                {repo.language || 'GitHub'} · {repo.fileCount.toLocaleString()}{' '}
                files
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">
                {formatLastSynced(repo.lastSynced)}
              </p>
            </div>
          </div>
          {repo.isIndexed ? (
            <span className="shrink-0 rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[10.5px] font-semibold text-[#047857]">
              Indexed
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#fffbeb] px-2.5 py-1 text-[10.5px] font-semibold text-[#b45309]">
              Not indexed
            </span>
          )}
        </div>
      </button>

      {!selectMode && (
        <div className="flex items-center justify-end gap-2 px-2 pb-1">
          {armed && (
            <button
              type="button"
              onClick={confirmRemove}
              disabled={removing}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#c8440a] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#a3350a] disabled:opacity-60"
            >
              {removing && (
                <span
                  aria-hidden="true"
                  className="h-[10px] w-[10px] rounded-full border-2 border-white/30 border-t-white animate-spin"
                />
              )}
              {removing ? 'Removing…' : 'Confirm remove?'}
            </button>
          )}
          <button
            type="button"
            onClick={handleArm}
            aria-label="Remove repository"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[#b45309] transition-colors hover:text-[#a3350a]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

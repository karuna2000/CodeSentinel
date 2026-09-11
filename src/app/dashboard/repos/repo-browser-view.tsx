'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/features/auth/components/user-avatar';

export interface Repository {
  id: string;
  github_repo_id: number;
  name: string;
  owner: string;
  default_branch: string;
  language: string | null;
  description: string | null;
  stars: number;
  is_indexed: boolean;
  file_count: number;
  readme_content: string | null;
  last_synced: string | null;
}

interface RepoBrowserViewProps {
  initialRepositories: Repository[];
  installUrl: string;
  userLogin?: string;
}

export function RepoBrowserView({
  initialRepositories,
  installUrl,
  userLogin,
}: RepoBrowserViewProps) {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>(initialRepositories);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');
  const [filterIndexed, setFilterIndexed] = useState<'ALL' | 'INDEXED' | 'UNINDEXED'>('ALL');
  const [indexingRepoId, setIndexingRepoId] = useState<string | null>(null);
  const [wikiGeneratingRepoId, setWikiGeneratingRepoId] = useState<string | null>(null);
  const [removingRepoId, setRemovingRepoId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const removeTimerRef = useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Distinct languages for filter pill tags
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    repositories.forEach((r) => {
      if (r.language) langs.add(r.language);
    });
    return Array.from(langs).sort();
  }, [repositories]);

  // Filtered repositories list
  const filteredRepos = useMemo(() => {
    return repositories.filter((repo) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesLanguage =
        selectedLanguage === 'ALL' || repo.language === selectedLanguage;

      const matchesIndexed =
        filterIndexed === 'ALL' ||
        (filterIndexed === 'INDEXED' && repo.is_indexed) ||
        (filterIndexed === 'UNINDEXED' && !repo.is_indexed);

      return matchesSearch && matchesLanguage && matchesIndexed;
    });
  }, [repositories, searchQuery, selectedLanguage, filterIndexed]);

  // Sync repositories list from GitHub App
  const handleSyncFromGitHub = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      if (data.repositories) {
        setRepositories(data.repositories);
        showToast('Repositories synchronized with GitHub App!');
      } else if (data.error) {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Failed to sync repositories', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger indexing on a single repository
  const handleIndexRepo = async (repo: Repository) => {
    setIndexingRepoId(repo.id);
    try {
      const res = await fetch(`/api/github/repos/${repo.id}/index`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        const updated = {
          ...repo,
          is_indexed: true,
          file_count: data.repository.fileCount,
          readme_content: data.repository.readmeContent !== undefined ? data.repository.readmeContent : repo.readme_content,
          last_synced: data.repository.lastSynced,
        };
        setRepositories((prev) =>
          prev.map((r) => (r.id === repo.id ? updated : r))
        );
        setSelectedRepo((curr) => (curr?.id === repo.id ? updated : curr));
        showToast(`Indexed ${data.repository.fileCount} files in ${repo.name}!`);
      } else {
        showToast(data.error || 'Failed to index repository', 'error');
      }
    } catch {
      showToast('Error indexing repository tree', 'error');
    } finally {
      setIndexingRepoId(null);
    }
  };

  // Trigger wiki generation for a single repository (runs as a background job)
  const handleGenerateWiki = async (repo: Repository) => {
    setWikiGeneratingRepoId(repo.id);
    try {
      const res = await fetch(`/api/github/repos/${repo.id}/wiki/generate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Wiki generation failed', 'error');
        return;
      }
      showToast('Wiki generation started — it runs in the background. Open the wiki to track progress.');
    } catch {
      showToast('Error starting wiki generation', 'error');
    } finally {
      setWikiGeneratingRepoId(null);
    }
  };

  // Two-step destructive action: first click arms "Confirm?", second executes.
  const handleRequestRemove = (repoId: string) => {
    setRemovingRepoId(repoId);
    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
    removeTimerRef.current = window.setTimeout(() => setRemovingRepoId(null), 4000);
  };

  const handleRemoveRepo = async (repo: Repository) => {
    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
    try {
      const res = await fetch(`/api/github/repos/${repo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to remove repository', 'error');
        return;
      }
      setRepositories((prev) => prev.filter((r) => r.id !== repo.id));
      setSelectedRepo((curr) => (curr?.id === repo.id ? null : curr));
      showToast(`Removed ${repo.owner}/${repo.name} (index, wiki, and diagrams).`);
    } catch {
      showToast('Failed to remove repository', 'error');
    } finally {
      setRemovingRepoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-10 md:px-8 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg font-code text-xs transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-800 text-emerald-100 border border-emerald-600'
              : 'bg-rose-800 text-rose-100 border border-rose-600'
          }`}
        >
          <span>{toastMessage.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-hd font-black text-3xl tracking-tight">CodeSentinel</span>
            <span className="bg-[var(--accent)] text-white font-code text-[10px] font-semibold px-2 py-0.5 rounded tracking-widest uppercase">
              Milestone 1
            </span>
          </div>
          <h1 className="text-xl font-semibold mt-2 text-[var(--text)]">Repository Knowledge Base</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Connect repositories to extract AST symbols, construct repository graphs, and build automated codebase wikis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 border-r border-[var(--border)] pr-3">
            {userLogin && (
              <span className="hidden lg:inline font-code text-[11px] text-[var(--muted)]">
                @{userLogin}
              </span>
            )}
            <UserAvatar />
          </div>
          <button
            onClick={handleSyncFromGitHub}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface)] text-sm font-medium transition disabled:opacity-50"
          >
            <span className={isSyncing ? 'animate-spin' : ''}>🔄</span>
            <span>{isSyncing ? 'Syncing…' : 'Sync Repos'}</span>
          </button>

          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--text)] text-[var(--bg)] hover:opacity-90 text-sm font-medium transition shadow-sm"
          >
            <span>➕</span>
            <span>Connect GitHub App</span>
          </a>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="my-8 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">🔍</span>
          <input
            type="text"
            placeholder="Search repositories by name, owner, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition"
          />
        </div>

        {/* Index Status Filter */}
        <div className="flex items-center gap-2 bg-[var(--card)] p-1 rounded-lg border border-[var(--border)] text-xs font-code">
          {(['ALL', 'INDEXED', 'UNINDEXED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterIndexed(status)}
              className={`px-3 py-1.5 rounded transition ${
                filterIndexed === status
                  ? 'bg-[var(--accent)] text-white font-medium shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {status === 'ALL' ? 'All Repos' : status === 'INDEXED' ? 'Indexed' : 'Unindexed'}
            </button>
          ))}
        </div>
      </div>

      {/* Language Filter Pills */}
      {availableLanguages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-xs text-[var(--muted)] font-code mr-1">Language:</span>
          <button
            onClick={() => setSelectedLanguage('ALL')}
            className={`px-2.5 py-1 rounded-full text-xs font-code transition ${
              selectedLanguage === 'ALL'
                ? 'bg-[var(--text)] text-[var(--bg)] font-medium'
                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            All
          </button>
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`px-2.5 py-1 rounded-full text-xs font-code transition ${
                selectedLanguage === lang
                  ? 'bg-[var(--text)] text-[var(--bg)] font-medium'
                  : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Repositories Grid / List */}
      {filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepos.map((repo) => {
            const isIndexing = indexingRepoId === repo.id;

            return (
              <div
                key={repo.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm hover:border-[var(--border2)] transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-code text-xs text-[var(--muted)]">{repo.owner}/</span>
                        <h3 className="font-semibold text-base text-[var(--text)] truncate">{repo.name}</h3>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1.5 line-clamp-2">
                        {repo.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-code px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${
                        repo.is_indexed
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50'
                          : 'bg-amber-950/40 text-amber-300 border border-amber-700/50'
                      }`}
                    >
                      {repo.is_indexed ? `Indexed (${repo.file_count} files)` : 'Not Indexed'}
                    </span>
                  </div>

                  {/* Metadata tags */}
                  <div className="flex items-center gap-4 mt-4 text-xs text-[var(--muted)] font-code">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                        {repo.language}
                      </span>
                    )}
                    <span>🌿 {repo.default_branch}</span>
                    {repo.stars > 0 && <span>⭐ {repo.stars}</span>}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-code text-[var(--muted)]">
                    {repo.last_synced
                      ? `Synced ${new Date(repo.last_synced).toISOString().split('T')[0]}`
                      : 'Never synced'}
                  </span>

                  <div className="flex items-center gap-2">
                    {repo.is_indexed && (
                      <>
                        <button
                          onClick={() => setSelectedRepo(repo)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] text-xs font-medium transition"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/repos/${repo.id}/wiki`)}
                          className="px-3 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition flex items-center gap-1"
                        >
                          <span>📖</span> Wiki
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/repos/${repo.id}/chat`)}
                          className="px-3 py-1.5 rounded-lg border border-orange-500/50 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-medium transition flex items-center gap-1"
                        >
                          <span>💬</span> Chat
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleIndexRepo(repo)}
                      disabled={isIndexing}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                        repo.is_indexed
                          ? 'bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text)] border border-[var(--border)]'
                          : 'bg-[var(--accent)] hover:opacity-90 text-white shadow-sm'
                      } disabled:opacity-60`}
                    >
                      {isIndexing ? (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          <span>Indexing…</span>
                        </>
                      ) : (
                        <span>{repo.is_indexed ? 'Re-Index Tree' : 'Index Repository'}</span>
                      )}
                    </button>

                    {repo.is_indexed && (
                      <button
                        onClick={() => handleGenerateWiki(repo)}
                        disabled={wikiGeneratingRepoId === repo.id}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm disabled:opacity-60"
                      >
                        {wikiGeneratingRepoId === repo.id ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            <span>Generating…</span>
                          </>
                        ) : (
                          <span>✨ Generate Wiki</span>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        removingRepoId === repo.id
                          ? handleRemoveRepo(repo)
                          : handleRequestRemove(repo.id)
                      }
                      title="Remove repository, index, wiki, and diagrams"
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                        removingRepoId === repo.id
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                          : 'border border-[var(--border)] text-[var(--muted)] hover:text-rose-600 hover:border-rose-600/50'
                      }`}
                    >
                      <span>🗑</span>
                      {removingRepoId === repo.id ? 'Confirm?' : 'Remove'}
                    </button>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center my-8">
          <span className="text-4xl">📦</span>
          <h3 className="font-semibold text-lg mt-3">No repositories found</h3>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto mt-1 mb-6">
            {repositories.length === 0
              ? 'Connect your GitHub App to grant CodeSentinel access to your code repositories.'
              : 'No repositories match your current filter and search query.'}
          </p>
          {repositories.length === 0 && (
            <a
              href={installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--text)] text-[var(--bg)] text-sm font-medium hover:opacity-90 transition"
            >
              <span>➕</span>
              <span>Connect GitHub App</span>
            </a>
          )}
        </div>
      )}

      {/* Repository Detail Modal */}
      {selectedRepo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="font-hd font-bold text-xl">{selectedRepo.owner}/{selectedRepo.name}</h3>
                <p className="text-xs text-[var(--muted)] font-code mt-0.5">
                  Default Branch: {selectedRepo.default_branch} · Indexed Files: {selectedRepo.file_count}
                </p>
              </div>
              <button
                onClick={() => setSelectedRepo(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface)] text-[var(--muted)] transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* README preview */}
              <div>
                <h4 className="text-xs font-code font-semibold tracking-wider uppercase text-[var(--muted)] mb-2">
                  Initial Seed Documentation (README.md)
                </h4>
                {selectedRepo.readme_content ? (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-xs font-code text-[var(--text)] whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                    {selectedRepo.readme_content}
                  </div>
                ) : (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center text-xs text-[var(--muted)]">
                    No README.md detected in repository root.
                  </div>
                )}
              </div>

              {/* Next Milestones Preview */}
              <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4">
                <h4 className="text-xs font-code font-semibold text-[var(--accent)] mb-1">
                  Ready for Milestone 2: Code Intelligence
                </h4>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  The file tree is securely seeded in PostgreSQL. In Milestone 2, Tree-sitter will parse AST symbols and construct the repository dependency graph.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-end">
              <button
                onClick={() => setSelectedRepo(null)}
                className="px-4 py-2 bg-[var(--text)] text-[var(--bg)] rounded-lg text-xs font-medium transition hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, BookOpen, Loader2, AlertCircle, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { WikiSidebar } from '@/features/wiki/components/wiki-sidebar';
import { WikiPageRenderer } from '@/features/wiki/components/wiki-page-renderer';
import { DiagramViewer } from '@/features/wiki/components/diagram-viewer';

interface WikiPageMeta { id: string; path: string; title: string; updated_at: string; }
interface DiagramMeta { id: string; path: string | null; type: string; updated_at: string; }
interface WikiPageFull extends WikiPageMeta { content: string; stale: boolean; }
interface DiagramFull { id: string; repo_id: string; path: string | null; type: string; mermaid_src: string; updated_at: string; }
interface DocStaleness { stale: boolean; indexCommitSha: string | null; stalePages: number; staleDiagrams: number; }

interface WikiIndexData {
  pages?: WikiPageMeta[];
  diagrams?: DiagramMeta[];
  staleness?: DocStaleness | null;
}

async function fetchWikiIndex(repoId: string): Promise<WikiIndexData> {
  const res = await fetch(`/api/github/repos/${repoId}/wiki`);
  if (!res.ok) throw new Error('Failed to load wiki index');
  return res.json();
}

export default function WikiPage() {
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;

  const [pages, setPages] = useState<WikiPageMeta[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [staleness, setStaleness] = useState<DocStaleness | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPageFull | null>(null);
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramFull | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState<string>('Queued…');
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const pollActiveRef = useRef(false);
  const autoSelectedRef = useRef(false);

  // Stop any in-flight polling when the component unmounts
  useEffect(() => {
    return () => {
      pollActiveRef.current = false;
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const handleSelectPage = useCallback(async (path: string) => {
    setSelectedPath(path);
    setSelectedDiagramId(null);
    setSelectedDiagram(null);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${repoId}/wiki/${path}`);
      if (!res.ok) throw new Error('Page not found');
      const page = await res.json();
      setSelectedPage(page);
    } catch {
      setSelectedPage(null);
    } finally {
      setContentLoading(false);
    }
  }, [repoId]);

  const handleSelectDiagram = useCallback(async (id: string) => {
    setSelectedDiagramId(id);
    setSelectedPath(null);
    setSelectedPage(null);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${repoId}/diagrams`);
      if (!res.ok) throw new Error('Failed to load diagrams');
      const data = await res.json();
      const diagram = data.diagrams.find((d: DiagramFull) => d.id === id);
      setSelectedDiagram(diagram ?? null);
    } catch {
      setSelectedDiagram(null);
    } finally {
      setContentLoading(false);
    }
  }, [repoId]);

  // Load sidebar index (auto-selects the first page once on initial load)
  const loadIndex = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const data = await fetchWikiIndex(repoId);
        const pages = data.pages ?? [];
        const diagrams = data.diagrams ?? [];
        setPages(pages);
        setDiagrams(diagrams);
        setStaleness(data.staleness ?? null);
        if (!autoSelectedRef.current) {
          if (pages.length > 0) {
            await handleSelectPage(pages[0].path);
          } else if (diagrams.length > 0) {
            await handleSelectDiagram(diagrams[0].id);
          }
          autoSelectedRef.current = true;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wiki');
      } finally {
        setLoading(false);
      }
    },
    [repoId, handleSelectPage, handleSelectDiagram]
  );

  useEffect(() => {
    let ignore = false;

    const boot = async () => {
      try {
        const data = await fetchWikiIndex(repoId);
        if (ignore) return;
        const pages = data.pages ?? [];
        const diagrams = data.diagrams ?? [];
        setPages(pages);
        setDiagrams(diagrams);
        setStaleness(data.staleness ?? null);
        if (!autoSelectedRef.current) {
          if (pages.length > 0) {
            await handleSelectPage(pages[0].path);
          } else if (diagrams.length > 0) {
            await handleSelectDiagram(diagrams[0].id);
          }
          autoSelectedRef.current = true;
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load wiki');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void boot();
    return () => {
      ignore = true;
    };
  }, [repoId, handleSelectPage, handleSelectDiagram]);

  const handleContentUpdated = useCallback(async () => {
    if (!selectedPage) return;
    try {
      const res = await fetch(`/api/github/repos/${repoId}/wiki/${selectedPage.path}`);
      if (!res.ok) throw new Error('Failed to reload page');
      const page = await res.json();
      setSelectedPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload page');
    }
  }, [repoId, selectedPage]);

  const pollGeneration = useCallback(
    async (jobId: string) => {
      pollActiveRef.current = true;

      const tick = async (): Promise<void> => {
        if (!pollActiveRef.current) return;
        try {
          const res = await fetch(
            `/api/github/repos/${repoId}/wiki/generate/${jobId}`
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Failed to check generation progress');
          }

          setGenerationProgress(data.progress ?? 0);
          setGenerationStep(data.step ?? 'Working…');

          if (data.status === 'SUCCEEDED') {
            setGenerating(false);
            await loadIndex();
            return;
          }

          if (data.status === 'FAILED') {
            setGenerating(false);
            setError(data.error || 'Wiki generation failed');
            return;
          }

          pollTimerRef.current = window.setTimeout(tick, 2000);
        } catch (err) {
          setGenerating(false);
          setError(err instanceof Error ? err.message : 'Failed to check generation progress');
        }
      };

      await tick();
    },
    [repoId, loadIndex]
  );

  const handleGenerateWiki = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setGenerationProgress(0);
    setGenerationStep('Queued…');
    try {
      const res = await fetch(`/api/github/repos/${repoId}/wiki/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Wiki generation failed');
      }
      const data = await res.json();
      if (!data.jobId) {
        throw new Error('Generation could not be started');
      }
      await pollGeneration(data.jobId);
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : 'Wiki generation failed');
    }
  }, [repoId, pollGeneration]);

  return (
    <div className="wiki-layout">
      {/* Top Navigation */}
      <header className="wiki-topbar">
        <div className="wiki-topbar-brand">
          <BookOpen size={18} />
          <span>Wiki</span>
        </div>
        <nav className="wiki-topbar-tabs">
          <span className="wiki-tab wiki-tab--active">
            <BookOpen size={14} /> Wiki
          </span>
          <Link href={`/dashboard/repos/${repoId}/chat`} className="wiki-tab">
            <MessageSquare size={14} /> Chat
          </Link>
        </nav>
      </header>

      <div className="wiki-body">
        {/* Sidebar */}
        {loading ? (
          <aside className="wiki-sidebar-skeleton">
            <div className="wiki-skeleton-line" />
            <div className="wiki-skeleton-line wiki-skeleton-line--short" />
            <div className="wiki-skeleton-line" />
          </aside>
        ) : (
          <WikiSidebar
            pages={pages}
            diagrams={diagrams}
            selectedPath={selectedPath}
            selectedDiagramId={selectedDiagramId}
            onSelectPage={handleSelectPage}
            onSelectDiagram={handleSelectDiagram}
          />
        )}

        {/* Main Content */}
        <main className="wiki-main">
          {error && (
            <div className="wiki-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {!generating && staleness?.stale && (
            <div className="wiki-stale-banner" role="status">
              <Clock size={16} />
              <div className="wiki-stale-banner-text">
                <strong>This wiki is out of date.</strong>
                <span>
                  {[
                    staleness.stalePages ? `${staleness.stalePages} page${staleness.stalePages === 1 ? '' : 's'}` : '',
                    staleness.staleDiagrams ? `${staleness.staleDiagrams} diagram${staleness.staleDiagrams === 1 ? '' : 's'}` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ')}{' '}
                  generated before the last repo sync.
                </span>
              </div>
              <button className="wiki-generate-btn wiki-generate-btn--sm" onClick={handleGenerateWiki}>
                <RefreshCw size={14} /> Regenerate
              </button>
            </div>
          )}

          {contentLoading && (
            <div className="wiki-content-loading">
              <Loader2 size={24} className="wiki-spin" />
              <span>Loading…</span>
            </div>
          )}

          {!contentLoading && selectedPage && (
            <WikiPageRenderer
              title={selectedPage.title}
              content={selectedPage.content}
              updatedAt={selectedPage.updated_at}
              path={selectedPage.path}
              repoId={repoId}
              stale={selectedPage.stale}
              onContentUpdated={handleContentUpdated}
            />
          )}

          {!contentLoading && selectedDiagram && (
            <div className="wiki-diagram-page">
              <h1 className="wiki-article-title">
                {selectedDiagram.type.charAt(0) + selectedDiagram.type.slice(1).toLowerCase()} Diagram
              </h1>
              <DiagramViewer mermaidSrc={selectedDiagram.mermaid_src} />
            </div>
          )}

          {!contentLoading && !selectedPage && !selectedDiagram && !loading && (
            <div className="wiki-empty-state">
              <BookOpen size={48} className="wiki-empty-icon" />
              <h2>{generating ? 'Generating your wiki' : 'No wiki page selected'}</h2>
              {generating ? (
                <div className="wiki-generating">
                  <Loader2 size={24} className="wiki-spin" />
                  <span>{generationStep}</span>
                  <div className="wiki-progress-track">
                    <div
                      className="wiki-progress-bar"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <span className="wiki-generating-note">
                    This can take a couple of minutes&mdash;you can leave this
                    page and come back.
                  </span>
                </div>
              ) : pages.length === 0 ? (
                <>
                  <p>
                    The wiki hasn&apos;t been generated yet. Generate an
                    AI-powered wiki with page summaries and architecture diagrams
                    from your indexed repo.
                  </p>
                  <button
                    className="wiki-generate-btn"
                    onClick={handleGenerateWiki}
                  >
                    <Sparkles size={16} />
                    Generate Wiki
                  </button>
                </>
              ) : (
                <p>Select a page from the sidebar to get started.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

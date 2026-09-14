'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { stagedProgress } from '../staged-index-progress';
import { ProgressBar } from './progress-bar';
import { GhostButton, PrimaryButton } from './buttons';

interface IndexWikiWorkflowProps {
  repoId: string;
  indexed: boolean;
  onIndexDone: (result: { fileCount: number }) => void;
  onWikiDone: (summary: { wikiPages: number; diagram: boolean }) => void;
}

type Phase = 'idle' | 'indexing' | 'generating' | 'done' | 'error';

interface WikiJob {
  status: string;
  progress?: number;
  wiki_pages?: number | null;
  diagram?: boolean | null;
  error?: string | null;
}

const POLL_MS = 2000;

/**
 * One-click pipeline: index the repository (blocking /index with a staged
 * progress hint) and, when that succeeds, automatically enqueue wiki
 * generation and stream its real job progress — a single trigger, two phases.
 */
export function IndexWikiWorkflow({
  repoId,
  indexed,
  onIndexDone,
  onWikiDone,
}: IndexWikiWorkflowProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [fileCount, setFileCount] = useState(0);
  const [wikiPages, setWikiPages] = useState(0);
  const [diagram, setDiagram] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const resetRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (stageTimerRef.current) window.clearInterval(stageTimerRef.current);
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (resetRef.current) window.clearTimeout(resetRef.current);
    };
  }, []);

  const poll = async (jobId: string) => {
    try {
      const res = await fetch(`/api/github/repos/${repoId}/wiki/generate/${jobId}`);
      const job = (await res.json()) as WikiJob;
      if (!res.ok) throw new Error(job.error || 'Failed to check wiki job');
      setProgress(job.progress ?? 0);
      if (job.status === 'SUCCEEDED') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setProgress(100);
        setLabel('Done');
        const summary = { wikiPages: job.wiki_pages ?? 0, diagram: Boolean(job.diagram) };
        setWikiPages(summary.wikiPages);
        setDiagram(summary.diagram);
        setPhase('done');
        onWikiDone(summary);
        resetRef.current = window.setTimeout(() => setPhase('idle'), 5000);
      } else if (job.status === 'FAILED') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setPhase('error');
        setError(job.error || 'Wiki generation failed');
      } else {
        setLabel('Generating wiki…');
      }
    } catch {
      // transient poll failure — keep polling
    }
  };

  const run = async () => {
    setError(null);
    setPhase('indexing');
    setProgress(0);
    startedAtRef.current = Date.now();

    const tick = () => {
      const { progress: p, label: l } = stagedProgress(Date.now() - startedAtRef.current);
      setProgress(p);
      setLabel(l);
    };
    tick();
    stageTimerRef.current = window.setInterval(tick, 250);

    try {
      const res = await fetch(`/api/github/repos/${repoId}/index`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        repository?: { fileCount?: number };
      };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to index repository');
      }
      if (stageTimerRef.current) window.clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
      const completed = data.repository?.fileCount ?? 0;
      setFileCount(completed);
      setProgress(100);
      setLabel('Indexed');
      onIndexDone({ fileCount: completed });

      setPhase('generating');
      setProgress(4);
      setLabel('Queuing wiki generation…');

      const genRes = await fetch(`/api/github/repos/${repoId}/wiki/generate`, { method: 'POST' });
      const gen = (await genRes.json().catch(() => ({}))) as { jobId?: string; error?: string };
      if (!genRes.ok) {
        throw new Error(
          typeof gen.error === 'string' ? gen.error : 'Failed to start wiki generation'
        );
      }
      const jobId = gen.jobId ?? null;
      if (!jobId) throw new Error('No wiki job returned');

      void poll(jobId);
      pollRef.current = window.setInterval(() => void poll(jobId), POLL_MS);
    } catch (e) {
      if (stageTimerRef.current) window.clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
      setPhase('error');
      setError(e instanceof Error ? e.message : 'The pipeline failed mid-run');
    }
  };

  if (phase === 'indexing' || phase === 'generating') {
    return (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-[#18181b]">{label}</span>
            <span className="font-mono text-[12px] tabular-nums text-[#71717a]">
              {Math.round(progress)}%
            </span>
          </div>
          <ProgressBar value={progress} />
          <p className="text-[12px] leading-snug text-[#71717a]">
            {phase === 'indexing'
              ? 'Building the knowledge graph — files, symbols, imports and embeddings.'
              : 'Generating page summaries and an architecture diagram in the background.'}
          </p>
        </div>
      );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#18181b]">
            <svg viewBox="0 0 20 20" className="h-[16px] w-[16px]" aria-hidden="true">
              <path
                d="m4 10.5 4 4 8-9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Indexed {fileCount} files · {wikiPages} wiki page{wikiPages === 1 ? '' : 's'}
            {diagram ? ' · diagram' : ''}
          </span>
          <GhostButton onClick={() => setPhase('idle')}>Re-index</GhostButton>
        </div>
        <ProgressBar value={100} />
        {wikiPages > 0 && (
          <Link
            href={`/dashboard/repos/${repoId}/wiki`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3f3f46] underline underline-offset-2 hover:text-[#27272a]"
          >
            Open the wiki
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#c8440a]/40 bg-[#fff0ed] px-3 py-2 text-[12px] text-[#a3350a]">
          <span aria-hidden="true" className="text-[13px] leading-none">⚠</span>
          <span className="break-words">{error}</span>
        </div>
        <GhostButton onClick={run}>Try again</GhostButton>
      </div>
    );
  }

  return (
    <PrimaryButton
      className="w-full"
      onClick={run}
      ariaLabel={indexed ? 'Re-index and regenerate wiki' : 'Index and generate wiki'}
    >
      {indexed ? 'Re-index' : 'Index'}
    </PrimaryButton>
  );
}
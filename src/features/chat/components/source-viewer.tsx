'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileCode, Loader2, Clipboard, Check } from 'lucide-react';

interface SourceViewerProps {
  repoId: string;
  nodeId: string | null;
  label: string;
  onClose: () => void;
}

interface EvidencePayload {
  nodeName: string;
  type: string;
  filePath: string | null;
  signature: string | null;
  codeSnippet: string | null;
  startLine: number | null;
  endLine: number | null;
  documentation: string | null;
}

export function SourceViewer({ repoId, nodeId, label, onClose }: SourceViewerProps) {
  const [data, setData] = useState<EvidencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;

    fetch(`/api/github/repos/${repoId}/chat/evidence?nodeId=${encodeURIComponent(nodeId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'Could not load evidence');
        }
        return res.json();
      })
      .then((payload: EvidencePayload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load evidence');
      });

    return () => {
      cancelled = true;
    };
  }, [repoId, nodeId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Source evidence"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col bg-[#fafaf8] border border-[#e4e4e7] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#e4e4e7]">
          <FileCode className="w-5 h-5 text-[var(--brand-green)] shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)] truncate">
              {data?.nodeName ?? label}
            </h3>
            <p className="text-xs text-[var(--brand-muted)] truncate">
              {data?.filePath ?? 'Loading source…'}
              {data?.startLine != null && data?.endLine != null
                ? ` · lines ${data.startLine}-${data.endLine}`
                : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-lg text-[var(--brand-muted)] hover:bg-[#f4f4f5] hover:text-[var(--brand-ink)] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}
          {!data && !error && (
            <div className="flex items-center gap-2 text-sm text-[var(--brand-muted)]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-green)]" />
              Loading source…
            </div>
          )}
          {data && (
            <div className="space-y-4">
              {data.signature && (
                <div className="px-4 py-2.5 rounded-lg bg-[#f4f4f5] border border-[#e4e4e7] font-mono text-[13px] text-[var(--brand-ink)] break-all">
                  {data.signature}
                </div>
              )}
              {data.documentation && (
                <div className="px-4 py-2.5 rounded-lg bg-white border border-[#e4e4e7] text-sm text-[var(--brand-muted)] whitespace-pre-wrap">
                  {data.documentation}
                </div>
              )}
              {data.codeSnippet ? (
                <div className="rounded-xl overflow-hidden border border-[#18181b] bg-[#18181b]">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#27272a] text-[#f4f4f5]">
                    <span className="text-xs font-mono">{(data.filePath ?? data.nodeName).split('/').pop()}</span>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(data.codeSnippet ?? '');
                        setCopied(true);
                        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
                        copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[#f4f4f5]/70 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label="Copy code"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-[#f4f4f5]">
                    <code>{data.codeSnippet}</code>
                  </pre>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-lg bg-white border border-[#e4e4e7] text-sm text-[var(--brand-muted)]">
                  No source snippet available for this node.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
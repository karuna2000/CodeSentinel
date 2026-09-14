'use client';

import { useState } from 'react';
import { FileCode, ShieldCheck, AlertTriangle, SearchX, ArrowRight, Sparkles } from 'lucide-react';
import type { ChatMeta } from '../lib/chat-meta';
import { STATUS_LABELS } from '../lib/chat-meta';
import { SourceViewer } from './source-viewer';

interface EvidencePanelProps {
  repoId: string;
  meta: ChatMeta | null;
  onPickFollowUp: (question: string) => void;
}

const STATUS_ICON = {
  grounded: ShieldCheck,
  limited_evidence: AlertTriangle,
  not_found: SearchX,
} as const;

export function EvidencePanel({ repoId, meta, onPickFollowUp }: EvidencePanelProps) {
  const [activeNode, setActiveNode] = useState<{ nodeId: string; label: string } | null>(null);

  return (
    <div className="h-full flex flex-col bg-[#fafaf8] border-l border-[#e4e4e7]">
      <div className="px-4 py-3.5 border-b border-[#e4e4e7]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand-green)]" />
          <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Investigation</h2>
          {meta && meta.evidence.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-[#f5f3ff] border border-[#ddd6fe] text-[11px] font-medium text-[var(--brand-green)]">
              {meta.evidence.length} {meta.evidence.length === 1 ? 'source' : 'sources'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!meta && (
          <div className="text-sm text-[var(--brand-muted)] leading-relaxed px-1">
            Ask a question and CodeSentinel will show the source evidence it grounded the answer in — with the
            exact file:line locations behind each claim.
          </div>
        )}

        {meta && (
          <>
            {/* Answer grounding status (§23, §24) */}
            <StatusStrip status={meta.status} intent={meta.intent} />

            {/* Evidence list — clickable → source viewer */}
            {meta.evidence.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                  Cited sources
                </p>
                {meta.evidence.map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setActiveNode({ nodeId: chip.nodeId, label: chip.label })}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg bg-white border border-[#e4e4e7] hover:border-[var(--brand-green)]/50 hover:bg-[#fafafa] transition-colors group"
                    title={`Open source: ${chip.nodeName}`}
                  >
                    <span className="shrink-0 text-[10px] font-bold text-[var(--brand-green)] bg-[#f5f3ff] border border-[#ddd6fe] rounded px-1.5 py-0.5">
                      {chip.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-[var(--brand-ink)] truncate">
                        {chip.nodeName}
                      </span>
                      <span className="block text-[11px] text-[var(--brand-muted)] truncate">
                        {chip.label}
                      </span>
                    </span>
                    <FileCode className="w-3.5 h-3.5 text-[var(--brand-muted)] group-hover:text-[var(--brand-green)] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Retrieval stats (§49) */}
            {meta.status !== 'not_found' && (
              <div className="flex items-center gap-2 text-[11px] text-[var(--brand-muted)] px-1">
                <span>lexical {meta.stats.lexicalHits}</span>
                <span className="text-[#d4d4d8]">·</span>
                <span>semantic {meta.stats.semanticHits}</span>
                <span className="text-[#d4d4d8]">·</span>
                <span>graph {meta.stats.graphExpanded}</span>
              </div>
            )}

            {/* Follow-up suggestions (§44) */}
            {meta.followUps.length > 0 && (
              <div className="pt-2 border-t border-[#e4e4e7]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-muted)] mb-2">
                  Keep exploring
                </p>
                <div className="space-y-1.5">
                  {meta.followUps.map((q, i) => (
                    <button
                      key={`${q}-${i}`}
                      onClick={() => onPickFollowUp(q)}
                      className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg bg-white/60 border border-[#e4e4e7] hover:border-[var(--brand-green)]/40 hover:bg-white transition-colors text-[12.5px] text-[var(--brand-ink)]"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--brand-green)]" />
                      <span className="leading-snug">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order matters: render the source viewer after the header so it stacks on top. */}
      <div className="relative">
        {activeNode && (
          <SourceViewer
            key={activeNode.nodeId}
            repoId={repoId}
            nodeId={activeNode.nodeId}
            label={activeNode.label}
            onClose={() => setActiveNode(null)}
          />
        )}
      </div>
    </div>
  );
}

function StatusStrip({ status, intent }: { status: ChatMeta['status']; intent: ChatMeta['intent'] }) {
  const label = STATUS_LABELS[status];
  const Icon = STATUS_ICON[status];

  const styles = {
    grounded: 'bg-[#f5f3ff] border-[#ddd6fe]',
    limited_evidence: 'bg-amber-50 border-amber-200',
    not_found: 'bg-amber-50 border-amber-200',
  } as const;
  const iconColor = {
    grounded: 'text-[var(--brand-green)]',
    limited_evidence: 'text-amber-600',
    not_found: 'text-amber-600',
  } as const;

  return (
    <div className={`px-3.5 py-3 rounded-lg border ${styles[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${iconColor[status]}`} />
        <span className="text-[12.5px] font-semibold text-[var(--brand-ink)]">{label.title}</span>
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-[var(--brand-muted)] bg-white/70 border border-[#e4e4e7] rounded px-1.5 py-0.5">
          {intent}
        </span>
      </div>
      <p className="text-[12px] text-[var(--brand-muted)] leading-relaxed mt-1.5">{label.detail}</p>
    </div>
  );
}
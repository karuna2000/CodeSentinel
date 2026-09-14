'use client';

import { useState } from 'react';
import { INTENT_LABELS, STATUS_LABELS, type ChatMeta } from '@/features/chat/lib/chat-meta';

interface EvidenceChip {
  id: string;
  label: string;
}

interface DemoResponse {
  text: string;
  meta: ChatMeta & { blocked?: boolean };
}

const SUGGESTIONS = [
  'How does authentication work?',
  'Where is rate limiting implemented?',
  'How does wiki generation work?',
];

/** Anonymous demo chat: single-shot Q&A over the pre-indexed demo repo. */
export function DemoChat() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<DemoResponse | null>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/demo/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const body = (await res.json()) as DemoResponse & { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not answer that question');
      setAnswer({ text: body.text, meta: body.meta });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer that question');
    } finally {
      setBusy(false);
    }
  };

  const meta = answer?.meta ?? null;
  const evidence = (meta?.evidence ?? []) as EvidenceChip[];
  const stats = meta?.stats as { lexicalHits: number; semanticHits: number; graphExpanded: number } | undefined;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="How does authentication work?"
          aria-label="Ask about the repository"
          className="h-11 min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 text-[13px] outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="h-11 shrink-0 rounded-full bg-zinc-900 px-6 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => {
              setQuery(s);
              void ask(s);
            }}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] text-zinc-600 hover:border-zinc-400 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      )}

      {answer && !error && (
        <div className="mt-4 rounded-2xl border border-zinc-200 p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {meta && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium">
                {INTENT_LABELS[meta.intent] ?? meta.intent}
              </span>
            )}
            {meta && (
              <span title={STATUS_LABELS[meta.status]?.detail} className="text-zinc-500">
                {STATUS_LABELS[meta.status]?.title}
              </span>
            )}
            {stats && (
              <span className="ml-auto tabular-nums text-zinc-400">
                lexical {stats.lexicalHits} · semantic {stats.semanticHits} · graph {stats.graphExpanded}
              </span>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{answer.text}</p>
          {evidence.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Sources ({evidence.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {evidence.map((chip) => (
                  <span
                    key={chip.id}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] text-zinc-600"
                  >
                    {chip.id} · {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

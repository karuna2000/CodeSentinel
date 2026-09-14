'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseZap, Loader2, AlertCircle } from 'lucide-react';

interface IndexPromptProps {
  repoId: string;
}

export function IndexPrompt({ repoId }: IndexPromptProps) {
  const router = useRouter();
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIndex = async () => {
    if (indexing) return;
    setIndexing(true);
    setError(null);
    try {
      const res = await fetch(`/api/github/repos/${repoId}/index`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Could not index the repository. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the indexer. Please try again.');
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="max-w-md w-full text-center bg-white border border-[#e4e4e7] rounded-2xl shadow-md p-8">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center mb-4">
          <DatabaseZap className="w-7 h-7 text-[var(--brand-green)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">This repository needs to be indexed</h2>
        <p className="mt-2 text-sm text-[var(--brand-muted)] leading-relaxed">
          Chat grounds every answer in the repository&apos;s indexed symbols and call graph. Index it
          now to enable grounded, evidence-cited answers.
        </p>
        {error && (
          <div className="mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={handleIndex}
          disabled={indexing}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-green)] text-white text-sm font-semibold shadow-sm hover:bg-[#27272a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {indexing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Indexing repository…
            </>
          ) : (
            'Index Repository'
          )}
        </button>
      </div>
    </div>
  );
}
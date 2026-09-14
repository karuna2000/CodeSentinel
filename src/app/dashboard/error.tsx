'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] page render failed:', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[var(--brand-cream)] px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#e5efe7] text-[var(--brand-green)]">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-[20px] font-bold text-[var(--brand-ink)]">
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-[var(--brand-muted)]">
          We couldn&apos;t load this page right now. This is usually a temporary
          issue &mdash; please try again in a moment.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-navy)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(16,27,62,0.18)] transition hover:bg-[var(--brand-navy-2)]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-[#e6e0d0] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--brand-ink)] transition hover:bg-white/80"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Auth Error — AgentReview',
};

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-[380px] bg-[var(--card)] border border-[var(--border)] rounded-[16px] shadow-xl px-8 py-10 flex flex-col gap-6 text-center">
        <div className="text-[40px]" aria-hidden="true">⚠️</div>
        <div>
          <h1 className="font-hd font-bold text-[20px] text-[var(--text)]">Authentication Error</h1>
          <p className="mt-2 font-body text-[13px] text-[var(--muted)] leading-relaxed">
            Something went wrong during sign-in. This is usually temporary.
          </p>
        </div>
        <Link
          href="/auth/signin"
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--accent)] text-white font-code text-[12px] font-medium rounded-[10px] hover:opacity-90 transition-opacity"
        >
          ← Try again
        </Link>
      </div>
    </div>
  );
}

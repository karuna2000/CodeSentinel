'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

interface GithubSignInButtonProps {
  callbackUrl?: string;
  className?: string;
}

export function GithubSignInButton({ callbackUrl = '/', className = '' }: GithubSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('github', { callbackUrl });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      id="github-signin-btn"
      onClick={handleSignIn}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label="Continue with GitHub"
      className={`
        group relative flex items-center justify-center gap-3 w-full
        px-5 py-3 rounded-[10px] border border-[var(--border)]
        bg-[var(--card)] text-[var(--text)] font-code text-[13px] font-medium
        transition-all duration-200
        hover:border-[var(--border2)] hover:bg-[var(--surface)] hover:shadow-md
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[var(--accent)]
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading ? (
        
        <span
          className="w-5 h-5 rounded-full border-2 border-[var(--border2)] border-t-[var(--accent)] animate-spin"
          aria-hidden="true"
        />
      ) : (
        
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      )}

      <span>{isLoading ? 'Signing in…' : 'Continue with GitHub'}</span>
    </button>
  );
}

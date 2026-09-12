'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { GithubMark } from './github-mark';

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
        relative w-full h-[65px] border-none bg-white rounded-full
        grid grid-cols-[48px_1fr_48px] items-center px-[21px]
        cursor-pointer text-[var(--brand-ink)] font-sans
        shadow-[0_3px_6px_rgba(10,20,15,0.02),0_9px_24px_rgba(20,40,30,0.025)]
        transition-transform duration-150 transition-shadow duration-150
        hover:-translate-y-0.5
        hover:shadow-[0_5px_12px_rgba(10,20,15,0.04),0_14px_30px_rgba(20,40,30,0.05)]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[var(--brand-accent)]
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <span className="grid place-items-center">
        {isLoading ? (
          <span
            className="w-[30px] h-[30px] rounded-full border-2 border-[var(--border2)] border-t-[var(--brand-green)] animate-spin"
            aria-hidden="true"
          />
        ) : (
          <GithubMark className="h-[30px] w-[30px] text-[#080808]" />
        )}
      </span>

      <span className="text-center font-semibold text-[16px]">
        {isLoading ? 'Signing in…' : 'Sign in with GitHub'}
      </span>
    </button>
  );
}

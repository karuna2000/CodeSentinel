'use client';

import { GoogleSignInButton } from '@/features/auth/components/google-sign-in-button';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already linked to a different sign-in method. Use the original provider.',
  OAuthSignin: 'Failed to start the Google sign-in flow. Please try again.',
  OAuthCallback: 'Error during Google authentication callback. Please try again.',
  OAuthCreateAccount: 'Could not create your account. Contact support if this persists.',
  AccessDenied: 'Access was denied. You may not have permission to use this application.',
  Verification: 'Sign-in link has expired or has already been used.',
  Default: 'An authentication error occurred. Please try again.',
};

interface SignInViewProps {
  error?: string;
  callbackUrl?: string;
}

export function SignInView({ error, callbackUrl = '/' }: SignInViewProps) {
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      {}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 60px)',
        }}
      />

      <main
        aria-label="Sign in to AgentReview"
        className="relative z-10 w-full max-w-[400px]"
      >
        {}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[16px] shadow-2xl px-8 py-10 flex flex-col gap-8">

          {}
          <header className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-3">
              <span className="font-hd font-black text-[28px] text-[var(--text)] tracking-[-0.02em]">
                AR
              </span>
              <span
                className="bg-[var(--accent)] text-white font-code text-[9px] font-semibold
                           px-[8px] py-[3px] rounded-[4px] tracking-[0.1em] uppercase"
              >
                Review
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="font-hd font-bold text-[20px] text-[var(--text)] leading-snug">
                Welcome back
              </h1>
              <p className="font-body text-[13px] text-[var(--muted)] leading-relaxed">
                Sign in to continue to your secure code review workspace.
              </p>
            </div>
          </header>

          {}
          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-3 bg-[#fff0ed] border border-[var(--danger)] text-[var(--danger)]
                         rounded-[8px] px-4 py-3"
            >
              <span aria-hidden="true" className="mt-0.5 text-[14px] shrink-0">⚠</span>
              <p className="font-code text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {}
          <div className="flex flex-col gap-4">
            <GoogleSignInButton callbackUrl={callbackUrl} />

            <p className="text-center font-code text-[10px] text-[var(--muted)] leading-relaxed px-2">
              By signing in you agree to our{' '}
              <span className="text-[var(--accent)] cursor-default">Terms of Service</span>
              {' '}and{' '}
              <span className="text-[var(--accent)] cursor-default">Privacy Policy</span>.
            </p>
          </div>

          {}
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="font-code text-[10px] text-[var(--muted)] tracking-widest uppercase">
              Secure
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {}
          <footer className="flex justify-center gap-6">
            {[
              { icon: '🔒', label: 'OAuth 2.0 + PKCE' },
              { icon: '🍪', label: 'httpOnly cookies' },
              { icon: '🔄', label: 'Auto token refresh' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-[16px]" aria-hidden="true">{icon}</span>
                <span className="font-code text-[9px] text-[var(--muted)] text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </footer>
        </div>

        {}
        <p className="mt-4 text-center font-code text-[10px] text-[var(--muted)]">
          AgentReview · Secure Code Analysis Platform
        </p>
      </main>
    </div>
  );
}

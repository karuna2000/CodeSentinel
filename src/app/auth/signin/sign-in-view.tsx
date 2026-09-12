'use client';

import { GithubSignInButton } from '@/features/auth/components/github-sign-in-button';
import { SigninProductArt } from '@/features/auth/components/signin-product-art';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already linked to a different sign-in method. Use the original provider.',
  OAuthSignin: 'Failed to start the GitHub sign-in flow. Please try again.',
  OAuthCallback: 'Error during GitHub authentication callback. Please try again.',
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
    <div className="signin-page h-screen" style={{ fontFamily: 'var(--font-sans)', color: 'var(--brand-ink)' }}>
      <main aria-label="Sign in to CodeSentinel" className="signin-shell">
        {/* LEFT PANEL */}
        <section className="signin-panel signin-panel--left">
          <a className="inline-flex items-center gap-[10px] text-[#162244] text-[20px] font-bold no-underline max-[520px]:text-[17px]" href="#">
            <div className="w-[39px] h-[39px] text-[#145c40] flex shrink-0" aria-hidden="true">
              <svg viewBox="0 0 44 44" className="w-full h-full">
                <path
                  d="M16 5 6 15l5 5m17-15 10 10-5 5M11 27l-5 5 10 10m17-15 5 5-10 10M26 9l-8 26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>CodeSentinel</span>
          </a>

          <div className="signin-center">
            <h1 className="signin-title">Welcome back</h1>

            <p className="signin-subtitle">
              Sign in with your GitHub account to continue
            </p>

            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-[24px] flex items-start gap-[9px] bg-[#fff0ed] border border-solid border-[#c8440a]/70 text-[#a3350a] rounded-[14px] px-[16px] py-[12px]"
              >
                <span aria-hidden="true" className="text-[14px] shrink-0 leading-none">⚠</span>
                <p className="m-0 text-[13px] leading-snug">{errorMessage}</p>
              </div>
            )}

            <GithubSignInButton callbackUrl={callbackUrl} />

            <div className="signin-note">
              <svg className="w-[17px] h-[17px] mt-[2px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8.5 10V7.5a3.5 3.5 0 1 1 7 0V10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>

              <p className="m-0 text-center text-[13px]" style={{ lineHeight: 1.55 }}>
                We only request the permissions needed<br />
                to access your repositories.
              </p>
            </div>

            <div className="signin-learn">
              <span>New to CodeSentinel?</span>
              <a className="text-[#175c42] underline" style={{ textUnderlineOffset: '3px' }} href="#">
                Learn more
              </a>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="signin-panel signin-panel--right">
          <blockquote className="signin-testimonial">
            <span aria-hidden="true" className="signin-quote signin-quote--start">
              “
            </span>

            <h2 className="signin-h2">
              Understand any codebase faster<br />
              with AI-powered insights, interactive<br />
              diagrams, and always up-to-date<br />
              documentation.
            </h2>

            <span aria-hidden="true" className="signin-quote signin-quote--end">
              ”
            </span>

            <footer className="signin-author">
              <div
                className="w-[46px] h-[46px] shrink-0 rounded-full grid place-items-center text-white text-[10px] font-bold border-2 border-solid border-[#eee]"
                style={{ background: 'linear-gradient(145deg, #dcdedc 0%, #838985 47%, #253530 48%, #17231f 100%)' }}
                aria-hidden="true"
              >
                AM
              </div>

              <div className="flex flex-col leading-[1.4]">
                <strong className="text-[14px]">Alex Mitchell</strong>
                <span className="text-[#525550] text-[12px]">Software Engineer</span>
                <small className="text-[#666964] text-[11px]">Amsterdam, NL</small>
              </div>
            </footer>
          </blockquote>

          <div className="signin-product-art">
            <SigninProductArt />
          </div>
        </section>
      </main>
    </div>
  );
}
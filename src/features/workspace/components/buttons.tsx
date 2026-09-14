import type { ReactNode } from 'react';

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  busy = false,
  className = '',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      aria-label={ariaLabel}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full border-none px-5 py-2.5 text-[13px] font-semibold text-white cursor-pointer bg-[#18181b] shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#27272a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71717a] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 ${className}`}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="w-[14px] h-[14px] rounded-full border-2 border-white/30 border-t-white animate-spin"
        />
      )}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white/60 px-4 py-2 text-[12px] font-semibold text-[#3f3f46] cursor-pointer transition-colors hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
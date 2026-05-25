import React from "react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred while rendering this component.",
  onRetry,
  className = "",
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-[20px] bg-[var(--surface)] border border-[var(--border)] rounded-[8px] ${className}`}
    >
      <div className={`mb-[10px] text-[var(--danger)] ${compact ? "text-[24px]" : "text-[32px]"}`}>
        ⚠️
      </div>
      <h3 className={`font-hd font-bold text-[var(--text)] mb-[6px] ${compact ? "text-[14px]" : "text-[16px]"}`}>
        {title}
      </h3>
      <p className={`font-code text-[var(--muted)] max-w-[320px] mb-[16px] ${compact ? "text-[11px]" : "text-[12px]"}`}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-[var(--text)] text-[var(--bg)] font-code text-[11px] px-[14px] py-[6px] rounded-[5px] transition-all duration-150 hover:bg-[var(--accent)] hover:scale-105"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

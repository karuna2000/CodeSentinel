import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--bg)] text-[var(--text)] font-code">
      <div className="text-[64px] mb-[10px]">🗺️</div>
      <h1 className="font-hd font-bold text-[24px] mb-[8px]">Page Not Found</h1>
      <p className="text-[var(--muted)] text-[13px] mb-[24px] max-w-[300px] text-center">
        We couldn&apos;t find the page you were looking for. It might have been moved or deleted.
      </p>
      <Link 
        href="/"
        className="bg-[var(--text)] text-[var(--bg)] font-code text-[12px] px-[16px] py-[8px] rounded-[6px] transition-all duration-150 hover:bg-[var(--accent)] hover:scale-105"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}

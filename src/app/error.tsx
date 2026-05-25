'use client'

import React from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)] text-[var(--text)]">
      <ErrorState 
        title="Application Error"
        message={error.message || "An unexpected error occurred in the application shell."}
        onRetry={() => reset()}
      />
    </div>
  )
}

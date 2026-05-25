'use client'

import React from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen w-full items-center justify-center bg-[var(--bg)] text-[var(--text)]">
          <ErrorState 
            title="Fatal Application Error"
            message={error.message || "A catastrophic error occurred. Please refresh the page."}
            onRetry={() => reset()}
          />
        </div>
      </body>
    </html>
  )
}

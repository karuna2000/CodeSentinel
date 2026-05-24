import React from "react";

interface CodeViewerProps {
  beforeCode: string;
  afterCode: string;
}

export function CodeViewer({ beforeCode, afterCode }: CodeViewerProps) {
  return (
    <div className="grid grid-cols-2 gap-[6px] mt-[4px]">
      <div className="rounded-[5px] overflow-hidden">
        <div className="p-[4px_10px] font-code text-[9px] font-semibold tracking-[0.06em] bg-[rgba(200,68,10,0.1)] text-[var(--danger)]">
          ❌ BEFORE
        </div>
        <div className="bg-[var(--card)] p-[7px_10px] font-code text-[10px] leading-[1.7] text-[var(--text)] overflow-x-auto whitespace-pre border border-[var(--border)] border-t-0">
          {beforeCode}
        </div>
      </div>
      <div className="rounded-[5px] overflow-hidden">
        <div className="p-[4px_10px] font-code text-[9px] font-semibold tracking-[0.06em] bg-[rgba(26,107,60,0.1)] text-[var(--accent2)]">
          ✅ AFTER
        </div>
        <div className="bg-[var(--card)] p-[7px_10px] font-code text-[10px] leading-[1.7] text-[var(--text)] overflow-x-auto whitespace-pre border border-[var(--border)] border-t-0">
          {afterCode}
        </div>
      </div>
    </div>
  );
}

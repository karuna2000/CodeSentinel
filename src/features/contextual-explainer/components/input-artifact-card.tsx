"use client";

import React, { useState } from "react";
import type { CodeLine, CodePin } from "./code-panel";
import type { ArtifactSource } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InputArtifactCardProps {
  filename: string;
  language: string;
  lines: number;
  size: string;
  source: ArtifactSource;
  codeLines: CodeLine[];
  pins: Record<number, CodePin>;
  onViewInPanel: () => void;
}

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

const SOURCE_CONFIG: Record<ArtifactSource, { icon: string; label: string; badgeClass: string }> = {
  upload: {
    icon: "📎",
    label: "Uploaded",
    badgeClass:
      "bg-[rgba(26,74,138,0.08)] border border-[rgba(26,74,138,0.18)] text-[var(--info)]",
  },
  paste: {
    icon: "📋",
    label: "Pasted",
    badgeClass:
      "bg-[rgba(200,68,10,0.07)] border border-[rgba(200,68,10,0.2)] text-[var(--accent)]",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InputArtifactCard = React.memo(function InputArtifactCard({
  filename,
  language,
  lines,
  size,
  source,
  codeLines,
  pins,
  onViewInPanel,
}: InputArtifactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { icon, label, badgeClass } = SOURCE_CONFIG[source];

  // Truncate for performance
  const MAX_LINES = 1000;
  const isTruncated = codeLines.length > MAX_LINES;
  const renderedLines = isTruncated ? codeLines.slice(0, MAX_LINES) : codeLines;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[2px_12px_12px_12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] max-w-[520px]">
      {/* ── Header ── */}
      <div className="flex items-center gap-[10px] p-[10px_13px] bg-[var(--surface)] border-b border-[var(--border)]">
        <span className="text-[15px]">{icon}</span>

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <div className="font-code text-[12px] font-semibold text-[var(--text)] truncate">
            {filename}
          </div>
          <div className="font-code text-[10px] text-[var(--muted)] mt-[1px] flex items-center gap-[5px] flex-wrap">
            <span>{language}</span>
            <span className="text-[var(--border2)]">·</span>
            <span>{lines} lines</span>
            <span className="text-[var(--border2)]">·</span>
            <span>{size}</span>
            <span className="text-[var(--border2)]">·</span>
            {/* Source badge */}
            <span className={`font-code text-[9px] px-[6px] py-[1px] rounded-[3px] font-semibold tracking-[0.04em] ${badgeClass}`}>
              {label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-[6px] shrink-0">
          <button
            onClick={onViewInPanel}
            className="bg-[var(--text)] border border-[var(--text)] text-[var(--bg)] font-code text-[10px] p-[4px_9px] rounded-[4px] cursor-pointer transition-all duration-150 hover:bg-[var(--accent)] hover:border-[var(--accent)]"
          >
            ⌨ View in panel
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="bg-transparent border border-[var(--border2)] text-[var(--muted)] font-code text-[10px] p-[4px_9px] rounded-[4px] cursor-pointer transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {expanded ? "↕ Collapse" : "↕ Expand"}
          </button>
        </div>
      </div>

      {/* ── Code Preview ── */}
      <div
        className={`overflow-hidden transition-[max-height] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${
          expanded ? "max-h-[500px]" : "max-h-[130px]"
        }`}
      >
        <div className="p-[10px_14px] font-code text-[10.5px] leading-[1.7] text-[var(--text)] overflow-x-auto bg-[var(--bg)]">
          {renderedLines.length > 0 ? (
            renderedLines.map((line) => {
              const hasPin = !!pins[line.num];
              return (
                <div
                  key={line.num}
                  id={`iac-${line.num}`}
                  className={`flex items-baseline gap-[10px] py-[1px] rounded-[2px] transition-colors duration-150 ${
                    hasPin
                      ? "bg-[var(--hl-line)] border-l-2 border-[var(--hl-border)] pl-[4px] -ml-[2px]"
                      : ""
                  }`}
                >
                  <span className="text-[var(--border2)] select-none min-w-[24px] text-right text-[10px] shrink-0">
                    {line.num}
                  </span>
                  <span
                    className="flex-1 whitespace-pre"
                    dangerouslySetInnerHTML={{ __html: line.code || " " }}
                  />
                </div>
              );
            })
          ) : (
            <div className="text-[var(--muted)] italic text-[11px]">
              No preview available
            </div>
          )}
          {isTruncated && expanded && (
            <div className="px-[10px] py-[6px] mt-[4px] bg-[rgba(200,68,10,0.05)] text-[var(--muted)] border-t border-[rgba(200,68,10,0.1)] italic text-[10px] whitespace-normal">
              ... {codeLines.length - MAX_LINES} remaining lines truncated for performance. View full payload in panel.
            </div>
          )}
        </div>

        {/* Fade gradient when collapsed */}
        {!expanded && codeLines.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[40px] bg-gradient-to-b from-transparent to-[var(--bg)] pointer-events-none" />
        )}
      </div>

      {/* ── Expand / Collapse footer ── */}
      {codeLines.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full bg-[var(--surface)] border-none border-t border-[var(--border)] text-[var(--muted)] font-code text-[10px] p-[6px] cursor-pointer transition-all duration-150 flex items-center justify-center gap-[5px] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.04)]"
        >
          {expanded ? "▲ Collapse" : `▼ Show all ${lines} lines`}
        </button>
      )}
    </div>
  );
});

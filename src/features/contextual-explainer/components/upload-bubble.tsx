import React, { useState } from "react";
import { CodeLine, CodePin } from "./code-panel";

interface UploadBubbleProps {
  filename: string;
  language: string;
  lines: number;
  size: string;
  codeLines: CodeLine[];
  pins: Record<number, CodePin>;
  onViewInPanel: () => void;
}

export function UploadBubble({
  filename,
  language,
  lines,
  size,
  codeLines,
  pins,
  onViewInPanel,
}: UploadBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[2px_12px_12px_12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] max-w-[520px]">
      <div className="flex items-center gap-[10px] p-[10px_13px] bg-[var(--surface)] border-b border-[var(--border)]">
        <span className="text-[16px]">📄</span>
        <div className="flex-1">
          <div className="font-code text-[12px] font-semibold text-[var(--text)]">{filename}</div>
          <div className="font-code text-[10px] text-[var(--muted)] mt-[1px]">
            {language} · {lines} lines · {size} · uploaded just now
          </div>
        </div>
        <div className="flex gap-[6px]">
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
      
      <div className={`overflow-hidden transition-[max-height] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${expanded ? "max-h-[500px]" : "max-h-[130px]"}`}>
        <div className="p-[10px_14px] font-code text-[10.5px] leading-[1.7] text-[var(--text)] overflow-x-auto bg-[var(--bg)]">
          {codeLines.map((line) => {
            const hasPin = !!pins[line.num];
            return (
              <div
                key={line.num}
                id={`ubl-${line.num}`}
                className={`flex items-baseline gap-[10px] py-[1px] rounded-[2px] transition-colors duration-150 ${
                  hasPin ? "bg-[var(--hl-line)] border-l-2 border-[var(--hl-border)] pl-[4px] -ml-[2px]" : ""
                }`}
              >
                <span className="text-[var(--border2)] select-none min-w-[24px] text-right text-[10px] shrink-0">
                  {line.num}
                </span>
                <span
                  className="flex-1 whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: line.code || " " }}
                ></span>
              </div>
            );
          })}
        </div>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[40px] bg-gradient-to-b from-transparent to-[var(--bg)] pointer-events-none" />
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-[var(--surface)] border-none border-t border-[var(--border)] text-[var(--muted)] font-code text-[10px] p-[6px] cursor-pointer transition-all duration-150 flex items-center justify-center gap-[5px] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.04)]"
      >
        {expanded ? "▲ Collapse" : `▼ Show all ${lines} lines`}
      </button>
    </div>
  );
}

import React, { useEffect, useRef } from "react";

export interface CodeLine {
  num: number;
  code: string;
}

export interface CodePin {
  severity: "critical" | "high" | "medium" | "low";
  id: string;
}

interface CodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  language: string;
  codeLines: CodeLine[];
  pins: Record<number, CodePin>;
  activeLine: number | null;
  onPinClick: (id: string) => void;
}

const pinColors = {
  critical: "bg-[var(--danger)]",
  high: "bg-[var(--warn)]",
  medium: "bg-[var(--info)]",
  low: "bg-[#aaa]",
};

export const CodePanel = React.memo(function CodePanel({
  isOpen,
  onClose,
  filename,
  language,
  codeLines,
  pins,
  activeLine,
  onPinClick,
}: CodePanelProps) {
  const codeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLine && isOpen && codeWrapRef.current) {
      // Small timeout to allow any CSS transitions (like width changing from 0) to start
      setTimeout(() => {
        const container = codeWrapRef.current;
        if (!container) return;
        const lineEl = container.querySelector(`#cpln-${activeLine}`);
        if (lineEl) {
          const lineRect = lineEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = lineRect.top - containerRect.top;
          const centerOffset = container.clientHeight / 2 - lineRect.height / 2;
          
          container.scrollTo({
            top: container.scrollTop + relativeTop - centerOffset,
            behavior: "smooth"
          });
        }
      }, 50);
    }
  }, [activeLine, isOpen]);

  // Truncate to 1000 lines to prevent DOM freeze
  const MAX_LINES = 1000;
  const isTruncated = codeLines.length > MAX_LINES;
  const renderedLines = isTruncated ? codeLines.slice(0, MAX_LINES) : codeLines;

  return (
    <div
      className={`shrink-0 overflow-hidden bg-[var(--surface)] border-l border-[var(--border)] flex flex-col transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isOpen ? "w-[380px]" : "w-0 border-none"
      }`}
    >
      <div className="p-[10px_14px] border-b border-[var(--border)] flex items-center gap-[9px] shrink-0 bg-[var(--surface)] w-[380px]">
        <div className="font-code text-[11px] font-semibold text-[var(--text)] flex items-center gap-[7px] flex-1">
          📄 {filename}
          <span className="bg-[rgba(26,74,138,0.1)] text-[var(--info)] font-code text-[9px] p-[2px_7px] rounded-[3px]">
            {language}
          </span>
        </div>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-[var(--muted)] cursor-pointer text-[14px] p-[2px_6px] rounded-[4px] transition-all duration-120 hover:bg-[var(--border)] hover:text-[var(--text)]"
        >
          ✕
        </button>
      </div>

      <div className="p-[7px_14px] border-b border-[var(--border)] flex gap-[12px] shrink-0 bg-[var(--bg)] w-[380px]">
        <div className="font-code text-[10px] text-[var(--muted)] flex items-center gap-[5px]">
          <strong className="text-[var(--text)] font-semibold">{codeLines.length}</strong> lines
        </div>
        <div className="font-code text-[10px] text-[var(--muted)] flex items-center gap-[5px]">
          <strong className="text-[var(--text)] font-semibold">{Object.keys(pins).length}</strong> findings
        </div>
        <div className="font-code text-[10px] text-[var(--muted)] flex items-center gap-[4px]">
          <div className="w-[8px] h-[8px] bg-[var(--hl-line)] border border-[var(--hl-border)] rounded-[2px]"></div>
          highlighted = flagged line
        </div>
      </div>

      <div ref={codeWrapRef} className="flex-1 overflow-y-auto overflow-x-auto w-[380px]">
        <div className="py-[10px] font-code text-[11px] leading-[1.75] min-w-max">
          {renderedLines.map((line) => {
            const pin = pins[line.num];
            const isActive = activeLine === line.num;

            return (
              <div
                key={line.num}
                id={`cpln-${line.num}`}
                className={`flex items-baseline gap-0 px-[14px] transition-colors duration-200 cursor-default hover:bg-[rgba(26,22,18,0.03)] ${
                  isActive ? "bg-[var(--hl-line)] border-l-2 border-[var(--hl-border)] pl-[12px] animate-[cpPulse_0.9s_ease]" : ""
                }`}
              >
                <span className="w-[14px] shrink-0 flex items-center justify-center translate-y-[2px]">
                  {pin && (
                    <div
                      className={`w-[7px] h-[7px] rounded-full cursor-pointer transition-transform duration-150 hover:scale-125 ${
                        pinColors[pin.severity]
                      }`}
                      onClick={() => onPinClick(pin.id)}
                      title={`Finding on line ${line.num}`}
                    ></div>
                  )}
                </span>
                <span className={`min-w-[28px] text-right mr-[14px] text-[10px] shrink-0 select-none ${isActive ? "text-[#7a5800]" : "text-[var(--border2)]"}`}>
                  {line.num}
                </span>
                <span
                  className="flex-1 whitespace-pre overflow-x-visible text-[var(--text)]"
                  dangerouslySetInnerHTML={{ __html: line.code || " " }}
                ></span>
              </div>
            );
          })}
          {isTruncated && (
            <div className="px-[14px] py-[8px] mt-[4px] bg-[rgba(200,68,10,0.05)] text-[var(--muted)] border-t border-[rgba(200,68,10,0.1)] italic text-[10px]">
              ... {codeLines.length - MAX_LINES} remaining lines truncated for performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

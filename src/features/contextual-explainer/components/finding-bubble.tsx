import React, { useState } from "react";
import { CodeViewer } from "@/components/code-viewer";

interface FindingBubbleProps {
  id: string;
  category: "arch" | "sec" | "scale";
  severity: "critical" | "high" | "medium" | "low";
  tag: string;
  severityLabel: string;
  title: string;
  description: string;
  beforeCode: string;
  afterCode: string;
  line?: number;
  onAskFollowUp: (id: string, title: string) => void;
  onLineClick?: (line: number) => void;
}

const catBorderColors = {
  arch: "border-l-[var(--info)]",
  sec: "border-l-[var(--danger)]",
  scale: "border-l-[var(--warn)]",
};

const tagStyles = {
  arch: "bg-[rgba(26,74,138,0.12)] text-[var(--info)]",
  sec: "bg-[rgba(200,68,10,0.12)] text-[var(--danger)]",
  scale: "bg-[rgba(200,122,10,0.12)] text-[var(--warn)]",
};

const sevStyles = {
  critical: "bg-[rgba(200,68,10,0.15)] text-[var(--danger)]",
  high: "bg-[rgba(200,122,10,0.12)] text-[var(--warn)]",
  medium: "bg-[rgba(26,74,138,0.1)] text-[var(--info)]",
  low: "bg-[#eee] text-[#888]",
};

export function FindingBubble({
  id,
  category,
  severity,
  tag,
  severityLabel,
  title,
  description,
  beforeCode,
  afterCode,
  line,
  onAskFollowUp,
  onLineClick,
}: FindingBubbleProps) {
  const [resolved, setResolved] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(afterCode).catch(() => {});
  };

  return (
    <div className={`bg-[var(--bg)] border border-[var(--border)] border-l-4 rounded-[0_8px_8px_0] p-[10px_12px] mt-[8px] flex flex-col gap-[8px] ${catBorderColors[category]}`}>
      <div className="flex flex-wrap items-start gap-[7px]">
        <span className={`font-code text-[9px] font-semibold p-[2px_7px] rounded-[3px] uppercase tracking-[0.07em] shrink-0 ${tagStyles[category]}`}>
          {tag}
        </span>
        <span className={`font-code text-[9px] font-semibold p-[2px_7px] rounded-[3px] uppercase shrink-0 ${sevStyles[severity]}`}>
          {severityLabel}
        </span>
        {line && (
          <button 
            onClick={() => onLineClick?.(line)}
            className="inline-flex items-center gap-[5px] bg-[var(--hl-line)] border border-[var(--hl-border)] text-[#7a4a00] font-code text-[9px] p-[2px_8px] rounded-[3px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-[#ffd87a] hover:border-[#c8880a]"
          >
            <div className="w-[5px] h-[5px] rounded-full bg-[var(--hl-border)]"></div>
            Line {line}
          </button>
        )}
        <span className="font-body text-[12.5px] font-medium text-[var(--text)] leading-[1.4] flex-1">
          {title}
        </span>
      </div>
      
      <div className="text-[12px] leading-[1.7] text-[var(--text)]">
        {description}
      </div>

      <CodeViewer beforeCode={beforeCode} afterCode={afterCode} />

      <div className="flex flex-wrap gap-[5px]">
        <ActionButton onClick={handleCopy}>⎘ Copy fix</ActionButton>
        {line && (
          <ActionButton onClick={() => onLineClick?.(line)}>↗ Jump to line {line}</ActionButton>
        )}
        <ActionButton 
          onClick={() => setResolved(true)} 
          isResolved={resolved}
        >
          {resolved ? "✓ Resolved" : "✓ Mark resolved"}
        </ActionButton>
        <ActionButton onClick={() => onAskFollowUp(id, title)}>💬 Ask follow-up</ActionButton>
      </div>
    </div>
  );
}

function ActionButton({ onClick, children, isResolved }: { onClick: () => void; children: React.ReactNode; isResolved?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`bg-transparent border font-code text-[10px] p-[4px_10px] rounded-[4px] cursor-pointer transition-all duration-150 flex items-center gap-[5px] ${
        isResolved 
          ? "border-[var(--accent2)] text-[var(--accent2)] bg-[rgba(26,107,60,0.06)]"
          : "border-[var(--border2)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }`}
      disabled={isResolved}
    >
      {children}
    </button>
  );
}

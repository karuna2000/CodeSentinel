import React from "react";

interface MetricsCardProps {
  filename: string;
  lines: number;
  language: string;
  grade: string;
  score: number;
  status: string;
  archCount: number;
  secCount: number;
  scaleCount: number;
  onViewCode?: () => void;
}

export function MetricsCard({
  filename,
  lines,
  language,
  grade,
  score,
  status,
  archCount,
  secCount,
  scaleCount,
  onViewCode,
}: MetricsCardProps) {
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[8px] p-[12px_14px] mt-[10px] flex flex-col gap-[8px]">
      <div className="font-code text-[11px] text-[var(--muted)] flex items-center gap-[6px] pb-[8px] border-b border-[var(--border)]">
        📄 <strong className="text-[var(--text)]">{filename}</strong> &nbsp;·&nbsp; {lines} lines &nbsp;·&nbsp; {language} &nbsp;·&nbsp;
        {onViewCode && (
          <button 
            onClick={onViewCode}
            className="bg-[rgba(200,68,10,0.08)] border border-[rgba(200,68,10,0.2)] text-[var(--accent)] font-code text-[9px] px-[8px] py-[2px] rounded-[3px] cursor-pointer"
          >
            ⌨ View uploaded code
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-[10px]">
        <div className="font-hd font-black text-[36px] text-[var(--warn)] leading-none">
          {grade}
        </div>
        <div className="flex flex-col gap-[3px]">
          <span className="font-code text-[13px] font-semibold text-[var(--text)]">{score} / 100</span>
          <span className="text-[11px] text-[var(--accent)] font-code">{status}</span>
        </div>
      </div>

      <div className="flex flex-col gap-[4px] mt-[2px]">
        <MetricBar label="🏛 Arch" colorClass="text-[var(--info)]" barClass="bg-[var(--info)]" width="38%" count={archCount} />
        <MetricBar label="🔴 Security" colorClass="text-[var(--danger)]" barClass="bg-[var(--danger)]" width="50%" count={secCount} />
        <MetricBar label="📈 Scale" colorClass="text-[var(--warn)]" barClass="bg-[var(--warn)]" width="62%" count={scaleCount} />
      </div>

      <div className="text-[11px] text-[var(--muted)] font-code pt-[6px] border-t border-[var(--border)]">
        I've pinned flagged lines in the code view — click any <span className="inline-flex items-center gap-[3px] bg-[var(--hl-line)] border border-[var(--hl-border)] px-[6px] py-[1px] rounded-[3px] font-code text-[9px] text-[#7a4a00]"><div className="w-[5px] h-[5px] rounded-full bg-[var(--hl-border)]"></div>Line N</span> badge in a finding to jump there.
      </div>
    </div>
  );
}

function MetricBar({ label, colorClass, barClass, width, count }: { label: string; colorClass: string; barClass: string; width: string; count: number }) {
  return (
    <div className="flex items-center gap-[8px] font-code text-[11px]">
      <span className={`min-w-[80px] ${colorClass}`}>{label}</span>
      <div className="flex-1 h-[4px] bg-[var(--border)] rounded-[2px] overflow-hidden">
        <div className={`h-full rounded-[2px] transition-[width] duration-1000 delay-500 ${barClass}`} style={{ width }} />
      </div>
      <span className="text-[10px] text-[var(--muted)] min-w-[16px] text-right">{count}</span>
    </div>
  );
}

import React from "react";

interface HealthMeterProps {
  grade?: string;
  score?: number;
  status?: string;
}

export function HealthMeter({
  grade = "B+",
  score = 78,
  status = "⚠ Not prod-ready",
}: HealthMeterProps) {
  return (
    <div className="flex items-center gap-[10px] bg-[var(--bg)] border border-[var(--border)] rounded-[8px] px-[12px] py-[8px]">
      <div className="font-hd font-black text-[28px] text-[var(--warn)] leading-none">
        {grade}
      </div>
      <div className="flex flex-col">
        <span className="font-code text-[11px] text-[var(--text)] font-semibold">
          {score} / 100
        </span>
        <span className="text-[10px] text-[var(--muted)] font-code">
          {status}
        </span>
      </div>
    </div>
  );
}

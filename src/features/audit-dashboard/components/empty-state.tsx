import React from "react";

interface EmptyStateProps {
  onFileSelect: () => void;
}

export function EmptyState({ onFileSelect }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[16px] p-[40px] text-center">
      <div className="text-[40px]">🔍</div>
      <div className="font-hd text-[22px] font-bold text-[var(--text)]">
        Drop your code, I'll review it.
      </div>
      <div className="text-[13px] text-[var(--muted)] leading-[1.7] max-w-[360px]">
        Paste a file, upload code, or ask me to review something. I'll surface architectural risks, security threats, and scalability bottlenecks — conversationally.
      </div>
      <label className="border-2 border-dashed border-[var(--border2)] rounded-[12px] p-[20px_40px] cursor-pointer transition-all duration-150 font-code text-[11.5px] text-[var(--muted)] flex flex-col items-center gap-[6px] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.03)]">
        <input type="file" className="hidden" onChange={onFileSelect} />
        <span className="text-[22px]">📁</span>
        <span>Drop file or click to upload</span>
        <span className="text-[10px] text-[var(--border2)]">.ts .js .py .go .java .rb</span>
      </label>
    </div>
  );
}

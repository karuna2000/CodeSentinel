import React, { useState } from "react";
import { validateFileSize, validateFileType } from "@/lib/validation";

interface EmptyStateProps {
  onFileSelect: (file?: File) => void;
}

export function EmptyState({ onFileSelect }: EmptyStateProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    
    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      setError(sizeCheck.error || "File is invalid.");
      e.target.value = '';
      return;
    }

    
    const typeCheck = validateFileType(file);
    if (!typeCheck.valid) {
      setError(typeCheck.error || "File type is invalid.");
      e.target.value = '';
      return;
    }

    setError(null);
    onFileSelect(file);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[16px] p-[40px] text-center">
      <div className="text-[40px]">🔍</div>
      <div className="font-hd text-[22px] font-bold text-[var(--text)]">
        Drop your code, I'll review it.
      </div>
      <div className="text-[13px] text-[var(--muted)] leading-[1.7] max-w-[360px]">
        Paste a file, upload code, or ask me to review something. I'll surface architectural risks, security threats, and scalability bottlenecks — conversationally.
      </div>
      
      {error && (
        <div className="bg-[#fff0ed] text-[var(--danger)] border border-[var(--danger)] px-[16px] py-[8px] rounded-[8px] font-code text-[11px] max-w-[360px] animate-[msgIn_.2s_ease-out]">
          {error}
        </div>
      )}

      <label className="border-2 border-dashed border-[var(--border2)] rounded-[12px] p-[20px_40px] cursor-pointer transition-all duration-150 font-code text-[11.5px] text-[var(--muted)] flex flex-col items-center gap-[6px] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.03)]">
        <input type="file" className="hidden" onChange={handleFileChange} />
        <span className="text-[22px]">📁</span>
        <span>Drop file or click to upload</span>
        <span className="text-[10px] text-[var(--border2)]">.ts .js .py .go .java .rb</span>
      </label>
    </div>
  );
}

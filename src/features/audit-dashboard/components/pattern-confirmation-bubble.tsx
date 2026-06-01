import React, { useState } from 'react';
import type { ProcessingResult } from '@/types/audit';

interface PatternConfirmationBubbleProps {
  result: ProcessingResult;
  taskContext: string;
  onConfirm: (correction?: string) => void;
}

export function PatternConfirmationBubble({ result, taskContext, onConfirm }: PatternConfirmationBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [correction, setCorrection] = useState('');
  const understanding = result.codeUnderstanding;

  if (!understanding) return null;

  const handleConfirm = () => {
    onConfirm(correction.trim() || undefined);
  };

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[8px] p-[16px] flex flex-col gap-[12px] w-full max-w-[500px] animate-in fade-in slide-in-from-bottom-2">
      <div className="font-code text-[12px] text-[var(--text)] leading-[1.5]">
        <strong className="text-[var(--accent)] block mb-[8px]">Scan Complete</strong>
        I've scanned <span className="font-semibold text-[var(--info)]">{result.payload.filename}</span>. Here is the context I detected:
      </div>

      <div className="bg-[rgba(26,22,18,0.03)] border border-[rgba(26,22,18,0.06)] rounded-[6px] p-[10px] flex flex-col gap-[6px]">
        <div className="flex text-[11px] font-code">
          <span className="w-[85px] text-[var(--muted)] shrink-0">Frameworks:</span>
          <span className="text-[var(--text)] font-medium">
            {understanding.dependencies.length > 0 ? understanding.dependencies.join(', ') : 'None detected'}
          </span>
        </div>
        <div className="flex text-[11px] font-code">
          <span className="w-[85px] text-[var(--muted)] shrink-0">Architecture:</span>
          <span className="text-[var(--text)] font-medium">
            {understanding.architecturalSignals.length > 0 ? understanding.architecturalSignals.join(', ') : 'Standard'}
          </span>
        </div>
        <div className="flex text-[11px] font-code">
          <span className="w-[85px] text-[var(--muted)] shrink-0">Your Prompt:</span>
          <span className="text-[var(--text)] font-medium italic">
            {taskContext ? `"${taskContext}"` : '(No extra context provided)'}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-[8px] animate-in fade-in zoom-in-95">
          <label className="text-[10px] font-code text-[var(--muted)] uppercase tracking-wider font-semibold">
            Correction / Override
          </label>
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="e.g. Actually this is Vue, and focus only on X..."
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-[6px] p-[8px] text-[12px] font-body text-[var(--text)] resize-none outline-none focus:border-[var(--accent)] min-h-[60px]"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-[8px] pt-[4px]">
        <button
          onClick={handleConfirm}
          className="bg-[var(--accent)] text-white hover:bg-[#c93b08] px-[14px] py-[6px] rounded-[6px] text-[12px] font-code font-semibold transition-colors"
        >
          Confirm & Analyze
        </button>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-transparent text-[var(--muted)] hover:text-[var(--text)] border border-transparent hover:border-[var(--border)] px-[12px] py-[6px] rounded-[6px] text-[11px] font-code transition-all"
          >
            Edit Context
          </button>
        )}
      </div>
    </div>
  );
}

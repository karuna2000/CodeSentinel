import React, { useState, useRef } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onQuickSend: (message: string) => void;
}

export function ChatInput({ onSend, onQuickSend }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-[12px_20px] flex flex-col gap-[8px]">
      <div className="flex items-end gap-[10px]">
        <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-[10px] p-[10px_14px] flex items-end gap-[8px] transition-colors duration-150 focus-within:border-[var(--border2)] focus-within:shadow-[0_0_0_3px_rgba(26,22,18,0.06)]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything — 'show security issues', 'explain the JWT finding', 'fix the N+1 query'…"
            className="flex-1 bg-transparent border-none outline-none font-body text-[13px] text-[var(--text)] resize-none min-h-[22px] max-h-[120px] leading-[1.6] placeholder:text-[var(--muted)]"
          />
          <label className="bg-transparent border-none text-[var(--muted)] cursor-pointer text-[16px] p-0 transition-colors duration-120 leading-none hover:text-[var(--accent)]" title="Attach file">
            <input type="file" className="hidden" onChange={() => onQuickSend("Attached file")} />
            📎
          </label>
        </div>
        <button
          onClick={handleSend}
          title="Send"
          className="bg-[var(--text)] text-[var(--bg)] border-none rounded-[8px] w-[40px] h-[40px] flex items-center justify-center cursor-pointer text-[16px] transition-all duration-150 shrink-0 hover:bg-[var(--accent)] hover:scale-105"
        >
          ↑
        </button>
      </div>
      <div className="flex gap-[6px] flex-wrap">
        <HintChip text="🔴 Security issues" onClick={() => onQuickSend("Walk me through the security issues")} />
        <HintChip text="🚨 Critical only" onClick={() => onQuickSend("What are the critical findings?")} />
        <HintChip text="🏛 Architecture" onClick={() => onQuickSend("Show me the architectural risks")} />
        <HintChip text="📈 Scalability" onClick={() => onQuickSend("What scalability bottlenecks exist?")} />
        <HintChip text="🔑 Fix JWT" onClick={() => onQuickSend("How do I fix the JWT issue?")} />
      </div>
    </div>
  );
}

function HintChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border border-[var(--border)] text-[var(--muted)] font-code text-[10px] p-[3px_9px] rounded-[20px] cursor-pointer transition-all duration-120 whitespace-nowrap hover:border-[var(--text)] hover:text-[var(--text)]"
    >
      {text}
    </button>
  );
}

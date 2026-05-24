import React from "react";

interface TimelineNodeProps {
  role: "user" | "ai";
  content: React.ReactNode;
  timestamp?: string;
  isTyping?: boolean;
}

export function TimelineNode({ role, content, timestamp, isTyping }: TimelineNodeProps) {
  const isUser = role === "user";

  return (
    <div className={`flex p-[6px_28px] gap-[12px] animate-[msgIn_0.3s_cubic-bezier(0.4,0,0.2,1)_both] ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center font-code text-[11px] font-semibold mt-[2px] ${
        isUser 
          ? "bg-[var(--accent)] text-white" 
          : "bg-[var(--text)] text-[var(--bg)] font-hd text-[13px] font-black"
      }`}>
        {isUser ? "JD" : "AR"}
      </div>
      
      <div className={`max-w-[72%] flex flex-col gap-[4px] ${isUser ? "items-end" : ""}`}>
        <div className={`flex items-center gap-[7px] font-code text-[9.5px] text-[var(--muted)] ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="font-semibold text-[var(--text)]">
            {isUser ? "You" : "AgentReview"}
          </span>
          {timestamp && <span>{timestamp}</span>}
        </div>
        
        <div className={`p-[12px_14px] text-[13px] leading-[1.75] shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${
          isUser
            ? "bg-[var(--user-bubble)] text-[var(--bg)] border-transparent rounded-[12px_2px_12px_12px] font-code text-[12px]"
            : "bg-[var(--ai-bubble)] text-[var(--text)] border border-[var(--border)] rounded-[2px_12px_12px_12px]"
        }`}>
          {isTyping ? (
            <div className="flex items-center gap-[4px] p-[4px_0] typing">
              <span /><span /><span />
            </div>
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  );
}

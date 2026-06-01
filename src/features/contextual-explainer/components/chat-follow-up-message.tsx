"use client";

import React, { useState } from "react";
import { TimelineNode } from "@/features/audit-dashboard/components/timeline-node";

interface ChatFollowUpMessageProps {
  content: string;
  isStreaming?: boolean;
  timestamp?: string;
}

/** Splits message text into segments of plain text and fenced code blocks */
function parseContentSegments(text: string) {
  const segments: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", content: match[2].trimEnd(), lang: match[1] || "text" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

/** Renders a fenced code block with a copy button */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="relative rounded-[6px] overflow-hidden border border-[var(--border)] mt-[8px] mb-[6px]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-[10px] py-[5px] bg-[var(--card)] border-b border-[var(--border)]">
        <span className="font-code text-[9.5px] text-[var(--muted)] tracking-[0.06em] uppercase">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className="font-code text-[9.5px] text-[var(--muted)] hover:text-[var(--accent)] transition-colors duration-120 flex items-center gap-[4px] cursor-pointer"
        >
          {copied ? "✓ Copied" : "⎘ Copy"}
        </button>
      </div>
      {/* Code body */}
      <pre className="bg-[var(--bg)] p-[10px_12px] overflow-x-auto font-code text-[11.5px] leading-[1.75] text-[var(--text)] m-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Renders plain text with basic markdown: bold (**text**) and inline code (`code`) */
function RichText({ text }: { text: string }) {
  // Split on bold **...** and inline code `...`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="bg-[var(--card)] border border-[var(--border)] px-[4px] py-[1px] rounded-[3px] font-code text-[11px] text-[var(--text)]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        // Preserve newlines as <br/>
        return (
          <span key={i}>
            {part.split("\n").map((line, li, arr) => (
              <React.Fragment key={li}>
                {line}
                {li < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </span>
  );
}

export function ChatFollowUpMessage({
  content,
  isStreaming = false,
  timestamp,
}: ChatFollowUpMessageProps) {
  const segments = parseContentSegments(content);

  const renderedContent = (
    <div className="flex flex-col gap-[4px]">
      {isStreaming && content === "" ? (
        <span className="flex items-center gap-[8px] text-[var(--muted)] font-code text-[12px] italic">
          <span className="w-[7px] h-[7px] rounded-full bg-[var(--accent)] animate-[pulse_1.2s_infinite]" />
          Thinking…
        </span>
      ) : (
        <>
          {segments.map((seg, i) =>
            seg.type === "code" ? (
              <CodeBlock key={i} code={seg.content} lang={seg.lang ?? "text"} />
            ) : (
              <p key={i} className="m-0 text-[13px] leading-[1.75] text-[var(--text)]">
                <RichText text={seg.content.trim()} />
              </p>
            )
          )}
          {isStreaming && (
            <span className="inline-block w-[8px] h-[14px] bg-[var(--accent)] rounded-[1px] animate-[pulse_0.8s_infinite] ml-[1px]" />
          )}
        </>
      )}
    </div>
  );

  return (
    <TimelineNode
      role="ai"
      timestamp={timestamp}
      content={renderedContent}
    />
  );
}

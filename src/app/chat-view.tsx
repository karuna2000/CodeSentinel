"use client";

import React, { useState } from "react";
import { IssueSidebar } from "@/features/audit-dashboard/components/issue-sidebar";
import { EmptyState } from "@/features/audit-dashboard/components/empty-state";
import { ChatInput } from "@/features/audit-dashboard/components/chat-input";
import { FindingBubble } from "@/features/contextual-explainer/components/finding-bubble";
import { CodePanel } from "@/features/contextual-explainer/components/code-panel";
import { InputArtifactCard } from "@/features/contextual-explainer/components/input-artifact-card";
import { TimelineNode } from "@/features/audit-dashboard/components/timeline-node";
import { UserAvatar } from "@/features/auth/components/user-avatar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { NetworkStatusIndicator } from "@/components/ui/network-status-indicator";
import { useUnifiedAudit } from "@/features/audit-dashboard/hooks/use-unified-audit";
import { appStore } from "@/stores/app.store";
import { artifactFromProcessingResult } from "@/types/artifact";
import { isLikelyCodeOrTechContent } from "@/lib/validation";
import { experimental_useObject } from "@ai-sdk/react";
import { ReasoningOutputSchema } from "@/types/llm-reasoning";
import type { CodePin } from "@/features/contextual-explainer/components/code-panel";
import type { Finding } from "@/types/llm-reasoning";
import type { ProcessingResult } from "@/types/audit";

interface StreamingTimelineNodeProps {
  initialResult: ProcessingResult;
  onLineClick: (lineNum: number) => void;
  onActiveStreamChange?: (isLoading: boolean, stopFn: (() => void) | null) => void;
}

export function StreamingTimelineNode({
  initialResult,
  onLineClick,
  onActiveStreamChange,
}: StreamingTimelineNodeProps) {
  const { object: streamedReasoning, submit, isLoading: isReasoning, stop } = experimental_useObject({
    api: "/api/audit/reason",
    schema: ReasoningOutputSchema,
  });

  const hasSubmitted = React.useRef(false);
  React.useEffect(() => {
    if (initialResult.codeUnderstanding && !hasSubmitted.current) {
      hasSubmitted.current = true;
      submit({
        understanding: initialResult.codeUnderstanding,
        content: initialResult.payload.content,
      });
    }
  }, [initialResult, submit]);

  const stopRef = React.useRef(stop);
  stopRef.current = stop;

  React.useEffect(() => {
    if (onActiveStreamChange) {
      onActiveStreamChange(isReasoning, isReasoning ? () => stopRef.current?.() : null);
    }
  }, [isReasoning, onActiveStreamChange]);

  const streamedReasoningStr = streamedReasoning ? JSON.stringify(streamedReasoning) : null;
  React.useEffect(() => {
    if (streamedReasoningStr) {
      appStore.setState((prev) => {
        if (!prev.processingResult) return prev;
        return {
          ...prev,
          processingResult: {
            ...prev.processingResult,
            reasoning: JSON.parse(streamedReasoningStr),
          },
        };
      });
    }
  }, [streamedReasoningStr]);

  const findings = streamedReasoning?.findings ?? initialResult.reasoning?.findings ?? [];
  const filename = initialResult.payload.filename;
  const lines = initialResult.payload.lineCount;
  const language = initialResult.payload.language;

  const STREAMING_THOUGHTS = React.useMemo(() => [
    "Analyzing service boundaries...",
    "Reviewing dependency flow...",
    "Checking authentication patterns...",
    "Inspecting scalability risks...",
    "Evaluating architecture quality...",
  ], []);

  const [thoughtIndex, setThoughtIndex] = React.useState(0);
  
  React.useEffect(() => {
    if (isReasoning && findings.length === 0) {
      const interval = setInterval(() => {
        setThoughtIndex((i) => (i + 1) % STREAMING_THOUGHTS.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isReasoning, findings.length, STREAMING_THOUGHTS.length]);

  // Compute counts dynamically
  const archCount = findings.filter(
    (f: any) => f?.category === "architecture" || f?.category === "maintainability"
  ).length;
  const secCount = findings.filter((f: any) => f?.category === "security").length;
  const scaleCount = findings.filter(
    (f: any) => f?.category === "scalability" || f?.category === "performance"
  ).length;

  // Dynamic Health Score computation
  const baseScore = 100;
  const totalDeduction = findings.reduce((acc: number, f: any) => {
    if (f?.severity === "critical") return acc + 25;
    if (f?.severity === "high") return acc + 15;
    if (f?.severity === "medium") return acc + 8;
    return acc + 3; // low
  }, 0);
  const score = Math.max(10, baseScore - totalDeduction);

  let grade = "A";
  let status = "✅ Looks clean";
  if (findings.length === 0) {
    grade = "—";
    status = isReasoning ? "⚡ Analyzing..." : "Waiting for results";
  } else if (score >= 95) {
    grade = "A";
    status = "✅ Looks great";
  } else if (score >= 90) {
    grade = "A-";
    status = "✅ Looks clean";
  } else if (score >= 80) {
    grade = "B+";
    status = "⚠️ Review recommended";
  } else if (score >= 70) {
    grade = "B";
    status = "⚠️ Not production-ready";
  } else if (score >= 50) {
    grade = "C";
    status = "🚨 Needs refactoring";
  } else {
    grade = "D";
    status = "🚨 Critical vulnerabilities";
  }

  // Calculate indicator widths
  const archWidth = archCount > 0 ? `${Math.min(100, (archCount / 5) * 100)}%` : "0%";
  const secWidth = secCount > 0 ? `${Math.min(100, (secCount / 5) * 100)}%` : "0%";
  const scaleWidth = scaleCount > 0 ? `${Math.min(100, (scaleCount / 5) * 100)}%` : "0%";

  if (isReasoning && findings.length === 0) {
    const currentThought = STREAMING_THOUGHTS[thoughtIndex];
    return (
      <TimelineNode
        role="ai"
        timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        content={
          <div className="flex flex-col gap-[14px] w-full animate-in fade-in duration-500">
            <span className="flex items-center gap-[8px] text-[var(--text)] font-code text-[12px] transition-all duration-300">
              <span className="w-[8px] h-[8px] rounded-full bg-[var(--accent)] animate-[pulse_1.5s_infinite]"></span>
              {currentThought}
            </span>
          </div>
        }
      />
    );
  }

  return (
    <TimelineNode
      role="ai"
      timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      content={
        <div className="flex flex-col gap-[14px] w-full">
          <div>
            {isReasoning ? (
              <span className="flex items-center gap-[6px]">
                <span className="w-[8px] h-[8px] rounded-full bg-[var(--accent)] animate-pulse"></span>
                Got it. Progressive structured review is streaming in for <strong>{filename}</strong>:
              </span>
            ) : (
              <span>Structured analysis complete for <strong>{filename}</strong>:</span>
            )}
          </div>

          {/* Real-time Metrics Card */}
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[8px] p-[12px_14px] flex flex-col gap-[8px]">
            <div className="font-code text-[11px] text-[var(--muted)] flex items-center justify-between pb-[8px] border-b border-[var(--border)]">
              <div className="flex items-center gap-[6px]">
                📄 <strong className="text-[var(--text)]">{filename}</strong> &nbsp;·&nbsp; {lines} lines &nbsp;·&nbsp; {language}
              </div>
            </div>
            
            <div className="flex items-center gap-[10px]">
              <div className="font-hd font-black text-[36px] text-[var(--warn)] leading-none">
                {grade}
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="font-code text-[13px] font-semibold text-[var(--text)]">{score} / 100</span>
                <span className="text-[11px] text-[var(--accent)] font-code flex items-center gap-[6px]">
                  {status}
                  {isReasoning && (
                    <span className="w-[8px] h-[8px] rounded-full bg-[var(--accent)] animate-ping"></span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-[4px] mt-[2px]">
              <div className="flex items-center gap-[8px] font-code text-[11px]">
                <span className="min-w-[80px] text-[var(--info)]">🏛 Arch</span>
                <div className="flex-1 h-[4px] bg-[var(--border)] rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px] bg-[var(--info)] transition-[width] duration-300" style={{ width: archWidth }} />
                </div>
                <span className="text-[10px] text-[var(--muted)] min-w-[16px] text-right">{archCount}</span>
              </div>
              <div className="flex items-center gap-[8px] font-code text-[11px]">
                <span className="min-w-[80px] text-[var(--danger)]">🔴 Security</span>
                <div className="flex-1 h-[4px] bg-[var(--border)] rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px] bg-[var(--danger)] transition-[width] duration-300" style={{ width: secWidth }} />
                </div>
                <span className="text-[10px] text-[var(--muted)] min-w-[16px] text-right">{secCount}</span>
              </div>
              <div className="flex items-center gap-[8px] font-code text-[11px]">
                <span className="min-w-[80px] text-[var(--warn)]">📈 Scale</span>
                <div className="flex-1 h-[4px] bg-[var(--border)] rounded-[2px] overflow-hidden">
                  <div className="h-full rounded-[2px] bg-[var(--warn)] transition-[width] duration-300" style={{ width: scaleWidth }} />
                </div>
                <span className="text-[10px] text-[var(--muted)] min-w-[16px] text-right">{scaleCount}</span>
              </div>
            </div>

            <div className="text-[11px] text-[var(--muted)] font-code pt-[6px] border-t border-[var(--border)]">
              I&apos;ve pinned flagged lines in the code view — click any <span className="inline-flex items-center gap-[3px] bg-[var(--hl-line)] border border-[var(--hl-border)] px-[6px] py-[1px] rounded-[3px] font-code text-[9px] text-[#7a4a00]"><div className="w-[5px] h-[5px] rounded-full bg-[var(--hl-border)]"></div>Line N</span> badge in a finding to jump there.
            </div>
          </div>

          {/* Progressive Findings List */}
          <div className="flex flex-col gap-[8px] mt-[4px]">
            <div className="font-hd text-[12px] font-bold text-[var(--text)] flex items-center gap-[8px]">
              Review Findings ({findings.length})
              {isReasoning && <span className="text-[10.5px] text-[var(--muted)] font-code font-normal">(streaming findings...)</span>}
            </div>

            {findings.length === 0 ? (
              <div className="text-[11.5px] text-[var(--muted)] font-code italic py-[8px] border border-dashed border-[var(--border)] rounded-[6px] text-center">
                Waiting for the first finding to stream...
              </div>
            ) : (
              findings.map((f: any, index: number) => {
                const categoryLabel = f.category === "security" ? "Security" :
                                      f.category === "scalability" || f.category === "performance" ? "Scalability" : "Architectural";
                const categoryKey = f.category === "security" ? "sec" :
                                    f.category === "scalability" || f.category === "performance" ? "scale" : "arch";
                const severityLabel = f.severity?.toUpperCase() || "UNKNOWN";
                
                // Extract line number if possible
                let foundLine: number | null = null;
                for (const ev of (f.evidence || [])) {
                  const lineMatch = ev.match(/(?:line|L)\s*(\d+)/i) || ev.match(/^(\d+)$/);
                  if (lineMatch) {
                    foundLine = parseInt(lineMatch[1], 10);
                    break;
                  }
                }

                if (!foundLine && initialResult.codeLines.length > 0) {
                  for (const ev of (f.evidence || [])) {
                    if (ev.length > 5) {
                      const matchedLine = initialResult.codeLines.find((l: any) => {
                        const normCode = l.code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").toLowerCase();
                        return normCode.includes(ev.toLowerCase());
                      });
                      if (matchedLine) {
                        foundLine = matchedLine.num;
                        break;
                      }
                    }
                  }
                }

                let beforeCodeSnippet = "";
                if (foundLine && initialResult.codeLines.length > 0) {
                  const idx = initialResult.codeLines.findIndex((l: any) => l.num === foundLine);
                  if (idx !== -1) {
                    const startIdx = Math.max(0, idx - 1);
                    const endIdx = Math.min(initialResult.codeLines.length - 1, idx + 1);
                    beforeCodeSnippet = initialResult.codeLines
                      .slice(startIdx, endIdx + 1)
                      .map((l: any) => l.code
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                      )
                      .join('\n');
                  }
                } else if ((f.evidence || []).length > 0) {
                  beforeCodeSnippet = f.evidence!.join('\n');
                }

                return (
                  <div key={`f-${index}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <FindingBubble
                      id={`f-${index}`}
                      category={categoryKey}
                      severity={f.severity}
                      tag={categoryLabel}
                      severityLabel={severityLabel}
                      title={f.title}
                      description={f.explanation}
                      beforeCode={beforeCodeSnippet}
                      afterCode={f.recommendation}
                      line={foundLine ?? undefined}
                      onAskFollowUp={() => {}}
                      onLineClick={onLineClick}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      }
    />
  );
}

export default function Page() {
  const {
    processingResult,
    processingState,
    validationError,
    setPayloadFromFile,
    setPayloadFromText,
    reset,
  } = useUnifiedAudit();

  const stopStreamRef = React.useRef<(() => void) | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamChange = React.useCallback((loading: boolean, stopFn: (() => void) | null) => {
    setIsStreaming(loading);
    stopStreamRef.current = stopFn;
  }, []);

  const [chatStarted, setChatStarted] = useState(false);
  type ChatMessageData = 
    | { type: 'text', id: string, role: 'user' | 'ai', content: string }
    | { type: 'review-request', id: string, result: ProcessingResult };
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Code Panel State
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const codeLines = React.useMemo(() => processingResult?.codeLines ?? [], [processingResult?.codeLines]);
  const filename = processingResult?.payload.filename ?? "uploaded-code";
  const language = processingResult?.payload.language ?? "Unknown";

  const handleLineClick = React.useCallback((lineNum: number) => {
    setIsCodePanelOpen(true);
    setActiveLine(lineNum);
    setTimeout(() => setActiveLine(null), 1500);
  }, []);

  const appendUserArtifactNode = React.useCallback((freshResult: ProcessingResult) => {
    const id = freshResult.payload.filename + Date.now();
    setMessages((prev) => [
      ...prev,
      { type: 'review-request', id, result: freshResult }
    ]);
    setIsTyping(false);
  }, []);

  const handleSend = React.useCallback((text: string) => {
    if (!chatStarted) {
      setChatStarted(true);
    }

    if (text.length >= 50 && isLikelyCodeOrTechContent(text)) {
      setPayloadFromText(text).then((result) => {
        if (result) appendUserArtifactNode(result);
      });
      return;
    }

    setMessages((prev) => [...prev, { type: 'text', id: `text-${Date.now()}`, role: 'user', content: text }]);
    
    // Simulate generic AI response for normal chat
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { type: 'text', id: `resp-${Date.now()}`, role: 'ai', content: "I can only review code at the moment. Please paste a valid code snippet or upload a file!" }]);
      setIsTyping(false);
    }, 1200);
  }, [chatStarted, setPayloadFromText, appendUserArtifactNode]);

  const handlePinClick = React.useCallback((id: string) => {
    handleSend(`Tell me more about finding ${id}`);
  }, [handleSend]);

  const handleCloseCodePanel = React.useCallback(() => {
    setIsCodePanelOpen(false);
  }, []);

  const handleFileSelect = async (file?: File) => {
    if (file) {
      const result = await setPayloadFromFile(file);
      if (result) appendUserArtifactNode(result);
    }
    setChatStarted(true);
  };

  const handleFileUpload = React.useCallback((file: File) => {
    if (!chatStarted) {
      setChatStarted(true);
    }
    setPayloadFromFile(file).then((result) => {
      if (result) appendUserArtifactNode(result);
    });
  }, [chatStarted, setPayloadFromFile, appendUserArtifactNode]);

  const handleNewReview = () => {
    setChatStarted(false);
    setIsCodePanelOpen(false);
    setMessages([]);
    reset();
  };

  // Dynamically generate pins from reasoning findings in real-time!
  const findings = React.useMemo(() => processingResult?.reasoning?.findings ?? [], [processingResult?.reasoning?.findings]);
  const dynamicPins = React.useMemo(() => {
    const pinsMap: Record<number, CodePin> = {};
    findings.forEach((finding, index) => {
      const severity = finding.severity === "critical" ? "critical" :
                       finding.severity === "high" ? "high" :
                       finding.severity === "medium" ? "medium" : "low";
      
      // Heuristic 1: Look for "line X" or "L X" or "X" in evidence array
      let foundLine: number | null = null;
      for (const ev of (finding.evidence || [])) {
        const lineMatch = ev.match(/(?:line|L)\s*(\d+)/i) || ev.match(/^(\d+)$/);
        if (lineMatch) {
          foundLine = parseInt(lineMatch[1], 10);
          break;
        }
      }

      // Heuristic 2: If no direct line match, search codeLines for evidence snippet
      if (!foundLine && codeLines.length > 0) {
        for (const ev of (finding.evidence || [])) {
          if (ev.length > 5) {
            const matchedLine = codeLines.find(l => {
              const normCode = l.code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").toLowerCase();
              return normCode.includes(ev.toLowerCase());
            });
            if (matchedLine) {
              foundLine = matchedLine.num;
              break;
            }
          }
        }
      }

      if (foundLine) {
        pinsMap[foundLine] = {
          severity,
          id: `f-${index}`,
        };
      }
    });
    return pinsMap;
  }, [findings, codeLines]);

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <NetworkStatusIndicator />
      
      {/* TOPBAR */}
      <header className="h-[52px] bg-[var(--text)] flex items-center px-[20px] gap-[14px] shrink-0 border-b border-[var(--border)]">
        <div className="font-hd font-black text-[17px] text-[var(--bg)] tracking-[-0.01em] flex items-center gap-[10px]">
          AR <span className="bg-[var(--accent)] text-white font-code text-[9px] font-semibold px-[7px] py-[2px] rounded-[3px] tracking-[0.08em] uppercase">Chat</span>
        </div>
        <div className="ml-[4px] bg-[rgba(245,240,232,0.12)] border border-[rgba(245,240,232,0.2)] text-[rgba(245,240,232,0.7)] font-code text-[10px] px-[10px] py-[3px] rounded-[20px] tracking-[0.05em] flex items-center gap-[6px]">
          <span className="w-[6px] h-[6px] rounded-full bg-[#4af0a0] animate-[blink_1.8s_infinite]"></span> Agent active
        </div>
        <div className="ml-auto flex items-center gap-[10px]">
          <button 
            className={`bg-transparent font-code text-[11px] px-[12px] py-[5px] rounded-[5px] cursor-pointer transition-all duration-150 border ${
              isCodePanelOpen 
                ? "bg-[rgba(200,68,10,0.7)] border-[rgba(200,68,10,0.9)] text-white hover:bg-[rgba(200,68,10,0.8)]" 
                : "border-[rgba(245,240,232,0.18)] text-[rgba(245,240,232,0.75)] hover:bg-[rgba(245,240,232,0.2)] hover:text-[var(--bg)]"
            }`}
            onClick={() => setIsCodePanelOpen(!isCodePanelOpen)}
          >
            ⌨ View Code
          </button>
          <button className="bg-[rgba(245,240,232,0.1)] border border-[rgba(245,240,232,0.18)] text-[rgba(245,240,232,0.75)] font-code text-[11px] px-[12px] py-[5px] rounded-[5px] cursor-pointer transition-all duration-150 hover:bg-[rgba(245,240,232,0.2)] hover:text-[var(--bg)]" onClick={handleNewReview}>
            + New Review
          </button>
          <button className="bg-[rgba(245,240,232,0.1)] border border-[rgba(245,240,232,0.18)] text-[rgba(245,240,232,0.75)] font-code text-[11px] px-[12px] py-[5px] rounded-[5px] cursor-pointer transition-all duration-150 hover:bg-[rgba(245,240,232,0.2)] hover:text-[var(--bg)]">
            Export PDF
          </button>
          <UserAvatar />
        </div>
      </header>

      {/* VALIDATION ERROR BANNER */}
      {validationError && (
        <div className="bg-[#fff0ed] text-[var(--danger)] border-b border-[var(--danger)] px-[20px] py-[8px] font-code text-[11px] flex items-center gap-[8px]">
          <span>⚠️</span> {validationError}
        </div>
      )}

      {/* SHELL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <ErrorBoundary fallbackTitle="Sidebar Error" fallbackMessage="Failed to load the issue tracker." compact>
          {chatStarted && <IssueSidebar onIssueClick={handleLineClick} isStreaming={isStreaming} />}
        </ErrorBoundary>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300">
          <div className="flex-1 overflow-y-auto py-[28px] flex flex-col gap-[0]">
            {!chatStarted ? (
              <EmptyState onFileSelect={handleFileSelect} />
            ) : (
              <ErrorBoundary fallbackTitle="Chat Error" fallbackMessage="Failed to render chat messages. Try reloading." className="h-full">
                {messages.map(m => {
                  if (m.type === 'text') {
                    return (
                      <TimelineNode
                        key={m.id}
                        role={m.role}
                        timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        content={m.content}
                      />
                    );
                  }
                  if (m.type === 'review-request') {
                    const artifact = artifactFromProcessingResult(
                      m.result,
                      m.result.payload.source === "paste" ? "paste" : "upload"
                    );
                    return (
                      <React.Fragment key={m.id}>
                        <TimelineNode
                          role="user"
                          timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          content={
                            <div className="flex flex-col gap-[8px]">
                              <InputArtifactCard
                                filename={artifact.filename}
                                language={artifact.language}
                                lines={artifact.lineCount}
                                size={artifact.formattedSize}
                                source={artifact.source}
                                codeLines={m.result.codeLines}
                                pins={m.result.pins}
                                onViewInPanel={() => setIsCodePanelOpen(true)}
                              />
                            </div>
                          }
                        />
                        <StreamingTimelineNode 
                          initialResult={m.result}
                          onLineClick={handleLineClick}
                          onActiveStreamChange={handleStreamChange}
                        />
                      </React.Fragment>
                    );
                  }
                  return null;
                })}
                {isTyping && <TimelineNode role="ai" isTyping content="" />}
                
                {processingState === 'normalizing' && (
                  <TimelineNode role="ai" timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} content={<span className="flex items-center gap-[6px] text-[var(--muted)] italic font-code"><span className="w-[6px] h-[6px] rounded-full bg-[var(--info)] animate-pulse"></span> Normalizing payload...</span>} />
                )}
                {processingState === 'understanding' && (
                  <TimelineNode role="ai" timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} content={<span className="flex items-center gap-[6px] text-[var(--muted)] italic font-code"><span className="w-[6px] h-[6px] rounded-full bg-[var(--info)] animate-pulse"></span> Extracting architecture and metadata...</span>} />
                )}
                {processingState === 'grounding' && (
                  <TimelineNode role="ai" timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} content={<span className="flex items-center gap-[6px] text-[var(--muted)] italic font-code"><span className="w-[6px] h-[6px] rounded-full bg-[var(--info)] animate-pulse"></span> Retrieving version-specific knowledge...</span>} />
                )}
              </ErrorBoundary>
            )}
          </div>

          <ChatInput 
            onSend={handleSend} 
            onQuickSend={handleSend} 
            onFileUpload={handleFileUpload}
            isReasoning={isStreaming}
            onCancel={() => {
              stopStreamRef.current?.();
              setIsStreaming(false);
            }}
          />
        </div>

        {/* CODE PANEL — powered by real codeLines from the pipeline */}
        <ErrorBoundary fallbackTitle="Code Panel Error" fallbackMessage="Failed to render code preview." className="w-[380px] h-full" compact>
          <CodePanel
            isOpen={isCodePanelOpen}
            onClose={handleCloseCodePanel}
            filename={filename}
            language={language}
            codeLines={codeLines}
            pins={dynamicPins}
            activeLine={activeLine}
            onPinClick={handlePinClick}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { IssueSidebar } from "@/features/audit-dashboard/components/issue-sidebar";
import { EmptyState } from "@/features/audit-dashboard/components/empty-state";
import { ChatInput } from "@/features/audit-dashboard/components/chat-input";
import { TimelineNode } from "@/features/audit-dashboard/components/timeline-node";
import { MetricsCard } from "@/features/audit-dashboard/components/metrics-card";
import { FindingBubble } from "@/features/contextual-explainer/components/finding-bubble";
import { CodePanel } from "@/features/contextual-explainer/components/code-panel";
import { InputArtifactCard } from "@/features/contextual-explainer/components/input-artifact-card";
import { UserAvatar } from "@/features/auth/components/user-avatar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { NetworkStatusIndicator } from "@/components/ui/network-status-indicator";
import { useUnifiedAudit } from "@/features/audit-dashboard/hooks/use-unified-audit";
import { appStore } from "@/stores/app.store";
import { artifactFromProcessingResult } from "@/types/artifact";
import { isLikelyCodeOrTechContent } from "@/lib/validation";
import type { CodePin } from "@/features/contextual-explainer/components/code-panel";

export default function Page() {
  const {
    processingResult,
    processingState,
    validationError,
    setPayloadFromFile,
    setPayloadFromText,
    reset,
  } = useUnifiedAudit();

  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<React.ReactNode[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Code Panel State
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const codeLines = processingResult?.codeLines ?? [];
  const pins: Record<number, CodePin> = processingResult?.pins ?? {};
  const filename = processingResult?.payload.filename ?? "uploaded-code";
  const language = processingResult?.payload.language ?? "Unknown";
  const lineCount = processingResult?.payload.lineCount ?? 0;
  const formattedSize = processingResult?.formattedSize ?? "0 B";

  function computeGrade(lines: number): { grade: string; score: number; status: string } {
    if (lines > 300) return { grade: "B", score: 74, status: "⚠️ Review recommended" };
    if (lines > 100) return { grade: "B+", score: 78, status: "⚠️ Not production-ready" };
    if (lines > 30) return { grade: "A-", score: 88, status: "✅ Looks clean" };
    return { grade: "A", score: 95, status: "✅ Looks good" };
  }

  const handleLineClick = React.useCallback((lineNum: number) => {
    setIsCodePanelOpen(true);
    setActiveLine(lineNum);
    setTimeout(() => setActiveLine(null), 1500);
  }, []);

  const dispatchArtifactMessages = React.useCallback((options?: { replace?: boolean }) => {
    const freshResult = appStore.getState().processingResult;
    if (!freshResult) return;

    const artifact = artifactFromProcessingResult(
      freshResult,
      freshResult.payload.source === "paste" ? "paste" : "upload"
    );
    const { grade, score, status } = computeGrade(artifact.lineCount);
    const freshCodeLines = freshResult.codeLines;
    const freshPins = freshResult.pins;

    const userNode = (
      <TimelineNode
        key={`user-${artifact.id}`}
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
              codeLines={freshCodeLines}
              pins={freshPins}
              onViewInPanel={() => setIsCodePanelOpen(true)}
            />
          </div>
        }
      />
    );

    if (options?.replace) {
      setMessages([userNode]);
    } else {
      setMessages((prev) => [...prev, userNode]);
    }

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        <TimelineNode
          key={`ai-${artifact.id}`}
          role="ai"
          timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          content={
            <div>
              Got it. I've finished analysing <strong>{artifact.filename}</strong>. Here's your overview —
              <MetricsCard
                filename={artifact.filename}
                lines={artifact.lineCount}
                language={artifact.language}
                grade={grade}
                score={score}
                status={status}
                archCount={3}
                secCount={4}
                scaleCount={5}
                onViewCode={() => setIsCodePanelOpen(true)}
              />
            </div>
          }
        />
      ]);
      handleLineClick(18);
    }, 1200);
  }, [handleLineClick]);

  const handleSend = React.useCallback((text: string) => {
    if (!chatStarted) {
      setPayloadFromText(text);
      setChatStarted(true);
      return;
    }

    if (text.length >= 50 && isLikelyCodeOrTechContent(text)) {
      setPayloadFromText(text);
      dispatchArtifactMessages();
      return;
    }

    setMessages((prev) => [
      ...prev,
      <TimelineNode
        key={Date.now()}
        role="user"
        timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        content={text}
      />
    ]);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        <TimelineNode
          key={Date.now() + 1}
          role="ai"
          timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          content="I see what you mean. Let me analyze that context against the current payload."
        />
      ]);
    }, 1200);
  }, [chatStarted, dispatchArtifactMessages, setPayloadFromText]);

  const handlePinClick = React.useCallback((id: string) => {
    handleSend(`Tell me more about finding ${id}`);
  }, [handleSend]);

  const handleCloseCodePanel = React.useCallback(() => {
    setIsCodePanelOpen(false);
  }, []);

  const handleFileSelect = async (file?: File) => {
    if (file) {
      await setPayloadFromFile(file);
    }
    setChatStarted(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!chatStarted) {
      await setPayloadFromFile(file);
      setChatStarted(true);
    } else {
      await setPayloadFromFile(file);
      dispatchArtifactMessages();
    }
  };

  React.useEffect(() => {
    if (chatStarted && processingState === "done" && messages.length === 0) {
      dispatchArtifactMessages({ replace: true });
    }
  }, [chatStarted, processingState, messages.length, dispatchArtifactMessages]);

  const handleNewReview = () => {
    setChatStarted(false);
    setIsCodePanelOpen(false);
    setMessages([]);
    reset();
  };

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
          {chatStarted && <IssueSidebar />}
        </ErrorBoundary>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300">
          <div className="flex-1 overflow-y-auto py-[28px] flex flex-col gap-[0]">
            {!chatStarted ? (
              <EmptyState onFileSelect={handleFileSelect} />
            ) : (
              <ErrorBoundary fallbackTitle="Chat Error" fallbackMessage="Failed to render chat messages. Try reloading." className="h-full">
                {messages}
                {isTyping && <TimelineNode role="ai" isTyping content="" />}
              </ErrorBoundary>
            )}
          </div>

          <ChatInput onSend={handleSend} onQuickSend={handleSend} onFileUpload={handleFileUpload} />
        </div>

        {/* CODE PANEL — powered by real codeLines from the pipeline */}
        <ErrorBoundary fallbackTitle="Code Panel Error" fallbackMessage="Failed to render code preview." className="w-[380px] h-full" compact>
          <CodePanel
            isOpen={isCodePanelOpen}
            onClose={handleCloseCodePanel}
            filename={filename}
            language={language}
            codeLines={codeLines}
            pins={pins}
            activeLine={activeLine}
            onPinClick={handlePinClick}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

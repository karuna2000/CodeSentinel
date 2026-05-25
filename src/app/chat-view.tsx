"use client";

import React, { useState } from "react";
import { IssueSidebar } from "@/features/audit-dashboard/components/issue-sidebar";
import { EmptyState } from "@/features/audit-dashboard/components/empty-state";
import { ChatInput } from "@/features/audit-dashboard/components/chat-input";
import { TimelineNode } from "@/features/audit-dashboard/components/timeline-node";
import { MetricsCard } from "@/features/audit-dashboard/components/metrics-card";
import { FindingBubble } from "@/features/contextual-explainer/components/finding-bubble";
import { CodePanel, CodePin } from "@/features/contextual-explainer/components/code-panel";
import { UploadBubble } from "@/features/contextual-explainer/components/upload-bubble";
import { UserAvatar } from "@/features/auth/components/user-avatar";

const SOURCE_LINES = [
  { num:1,  code:`<span class="text-[#1a4a8a]">import</span> { Injectable } <span class="text-[#1a4a8a]">from</span> <span class="text-[#1a6b3c]">'@nestjs/common'</span>;` },
  { num:2,  code:`<span class="text-[#1a4a8a]">import</span> { UserService } <span class="text-[#1a4a8a]">from</span> <span class="text-[#1a6b3c]">'./user.service'</span>;` },
  { num:3,  code:`<span class="text-[#1a4a8a]">import</span> * <span class="text-[#1a4a8a]">as</span> jwt <span class="text-[#1a4a8a]">from</span> <span class="text-[#1a6b3c]">'jsonwebtoken'</span>;` },
  { num:4,  code:`` },
  { num:5,  code:`<span class="text-[#1a4a8a]">@Injectable</span>()` },
  { num:6,  code:`<span class="text-[#1a4a8a]">export class</span> <span class="text-[#8b4a00]">AuthService</span> {` },
  { num:7,  code:`  <span class="text-[var(--muted)] italic">// constructor — creates circular dep with UserService</span>` },
  { num:8,  code:`  <span class="text-[#1a4a8a]">constructor</span>(<span class="text-[#1a4a8a]">private</span> userSvc: UserService) {}` },
  { num:9,  code:`` },
  { num:10, code:`  <span class="text-[var(--muted)] italic">// login — compares plain-text passwords</span>` },
  { num:11, code:`  <span class="text-[#1a4a8a]">async</span> <span class="text-[#8b4a00]">login</span>(email, password) {` },
  { num:12, code:`    <span class="text-[#1a4a8a]">const</span> user = <span class="text-[#1a4a8a]">await</span> <span class="text-[#1a4a8a]">this</span>.userSvc.<span class="text-[#8b4a00]">find</span>(email);` },
  { num:13, code:`    <span class="text-[#1a4a8a]">return</span> user.password === password;` },
  { num:14, code:`  }` },
  { num:15, code:`` },
  { num:16, code:`  <span class="text-[var(--muted)] italic">// sign — hardcoded JWT secret</span>` },
  { num:17, code:`  <span class="text-[#8b4a00]">sign</span>(payload) {` },
  { num:18, code:`    <span class="text-[#1a4a8a]">return</span> jwt.<span class="text-[#8b4a00]">sign</span>(payload, <span class="text-[#1a6b3c]">'supersecret123'</span>);` },
  { num:19, code:`  }` },
  { num:20, code:`` },
  { num:21, code:`  <span class="text-[var(--muted)] italic">// getUsers — N+1 query pattern</span>` },
  { num:22, code:`  <span class="text-[#1a4a8a]">async</span> <span class="text-[#8b4a00]">getUsers</span>() {` },
  { num:23, code:`    <span class="text-[#1a4a8a]">const</span> users = <span class="text-[#1a4a8a]">await</span> <span class="text-[#1a4a8a]">this</span>.userSvc.<span class="text-[#8b4a00]">findAll</span>();` },
  { num:24, code:`    <span class="text-[#1a4a8a]">for</span> (<span class="text-[#1a4a8a]">const</span> u <span class="text-[#1a4a8a]">of</span> users) {` },
  { num:25, code:`      u.roles = <span class="text-[#1a4a8a]">await</span> <span class="text-[#1a4a8a]">this</span>.userSvc.<span class="text-[#8b4a00]">getRoles</span>(u.id);` },
  { num:26, code:`    }` },
  { num:27, code:`  }` },
  { num:28, code:`}` },
];

const LINE_PINS: Record<number, CodePin> = {
  8:  { severity: 'high', id: 'f1' },
  13: { severity: 'critical', id: 'f5' },
  18: { severity: 'critical', id: 'f4' },
  25: { severity: 'high', id: 'f8' },
};

export default function Page() {
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<React.ReactNode[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // Code Panel State
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const startChat = () => {
    if (chatStarted) return;
    setChatStarted(true);
    
    setMessages([
      <TimelineNode 
        key="1" 
        role="user" 
        timestamp={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        content={
          <div className="flex flex-col gap-[8px]">
            <UploadBubble
              filename="auth.service.ts"
              language="TypeScript"
              lines={28}
              size="1.2 KB"
              codeLines={SOURCE_LINES}
              pins={LINE_PINS}
              onViewInPanel={() => setIsCodePanelOpen(true)}
            />
          </div>
        }
      />
    ]);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        <TimelineNode
          key="2"
          role="ai"
          timestamp={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          content={
            <div>
              Got it. I've finished analysing <strong>auth.service.ts</strong>. Here's your overview —
              <MetricsCard
                filename="auth.service.ts"
                lines={89}
                language="TypeScript / NestJS"
                grade="B+"
                score={78}
                status="⚠️ Not production-ready"
                archCount={3}
                secCount={4}
                scaleCount={5}
                onViewCode={() => setIsCodePanelOpen(true)}
              />
            </div>
          }
        />
      ]);
    }, 1600);
  };

  const handleLineClick = (lineNum: number) => {
    if (!isCodePanelOpen) setIsCodePanelOpen(true);
    setActiveLine(lineNum);
    // Clear active line after 1.5s to replay animation on subsequent clicks
    setTimeout(() => setActiveLine(null), 1500);
  };

  const handleSend = (text: string) => {
    if (!chatStarted) startChat();
    
    setMessages((prev) => [
      ...prev,
      <TimelineNode
        key={Date.now()}
        role="user"
        timestamp={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          timestamp={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          content={
            <div>
              You have a critical finding in Security that needs immediate attention on <button className="inline-flex items-center gap-[5px] bg-[var(--hl-line)] border border-[var(--hl-border)] text-[#7a4a00] font-code text-[9px] p-[2px_8px] rounded-[3px] cursor-pointer transition-all duration-150 hover:bg-[#ffd87a] hover:border-[#c8880a]" onClick={() => handleLineClick(18)}><div className="w-[5px] h-[5px] rounded-full bg-[var(--hl-border)]"></div>Line 18</button>:
              <FindingBubble
                id="f4"
                category="sec"
                severity="critical"
                tag="Security"
                severityLabel="Critical"
                title="Hardcoded JWT secret in source code"
                description="A leaked secret in source control means any attacker can forge valid JWT tokens and impersonate any user — including admins. Rotate the secret immediately."
                beforeCode="jwt.sign(payload, 'supersecret123')"
                afterCode={"const secret = this.cfg.get<string>('JWT_SECRET');\njwt.sign(payload, secret, {\n  expiresIn: '1h',\n  algorithm: 'RS256'\n});"}
                line={18}
                onLineClick={handleLineClick}
                onAskFollowUp={(id, title) => handleSend(`Tell me more about the "${title}" issue`)}
              />
            </div>
          }
        />
      ]);
      // Auto open code panel and focus line 18
      handleLineClick(18);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* TOPBAR */}
      <header className="h-[52px] bg-[var(--text)] flex items-center px-[20px] gap-[14px] shrink-0">
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
          <button className="bg-[rgba(245,240,232,0.1)] border border-[rgba(245,240,232,0.18)] text-[rgba(245,240,232,0.75)] font-code text-[11px] px-[12px] py-[5px] rounded-[5px] cursor-pointer transition-all duration-150 hover:bg-[rgba(245,240,232,0.2)] hover:text-[var(--bg)]" onClick={() => {setChatStarted(false); setIsCodePanelOpen(false); setMessages([])}}>
            + New Review
          </button>
          <button className="bg-[rgba(245,240,232,0.1)] border border-[rgba(245,240,232,0.18)] text-[rgba(245,240,232,0.75)] font-code text-[11px] px-[12px] py-[5px] rounded-[5px] cursor-pointer transition-all duration-150 hover:bg-[rgba(245,240,232,0.2)] hover:text-[var(--bg)]">
            Export PDF
          </button>
          <UserAvatar />
        </div>
      </header>

      {/* SHELL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <IssueSidebar />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300">
          {!chatStarted ? (
            <EmptyState onFileSelect={startChat} />
          ) : (
            <div className="flex-1 overflow-y-auto py-[28px] flex flex-col gap-[0]">
              {messages}
              {isTyping && <TimelineNode role="ai" isTyping content="" />}
            </div>
          )}

          <ChatInput onSend={handleSend} onQuickSend={handleSend} />
        </div>

        {/* CODE PANEL */}
        <CodePanel 
          isOpen={isCodePanelOpen} 
          onClose={() => setIsCodePanelOpen(false)}
          filename="auth.service.ts"
          language="TypeScript"
          codeLines={SOURCE_LINES}
          pins={LINE_PINS}
          activeLine={activeLine}
          onPinClick={(id) => handleSend(`Tell me more about finding ${id}`)}
        />
      </div>
    </div>
  );
}

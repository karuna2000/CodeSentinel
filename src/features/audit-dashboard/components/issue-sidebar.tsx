import React from "react";
import { HealthMeter } from "./health-meter";
import { useUnifiedAudit } from "../hooks/use-unified-audit";

const severityColors: Record<string, string> = {
  c: "bg-[var(--danger)]", // critical
  h: "bg-[var(--warn)]",   // high
  m: "bg-[var(--info)]",   // medium
  l: "bg-[#888]",          // low
};

export interface IssueSidebarProps {
  onIssueClick?: (lineNum: number) => void;
  isStreaming?: boolean;
}

export const IssueSidebar = React.memo(function IssueSidebar({ onIssueClick, isStreaming }: IssueSidebarProps) {
  const { processingResult, isReasoning: globalIsReasoning } = useUnifiedAudit();
  const isReasoning = isStreaming ?? globalIsReasoning;
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const findings = React.useMemo(() => processingResult?.reasoning?.findings ?? [], [processingResult?.reasoning?.findings]);
  const codeLines = React.useMemo(() => processingResult?.codeLines ?? [], [processingResult?.codeLines]);

  // Map real findings to displayable issues
  const displayIssues = React.useMemo(() => {
    return findings.map((f, index) => {
      // Map finding category to display category (arch, sec, scale)
      let cat = "arch";
      if (f.category === "security") {
        cat = "sec";
      } else if (f.category === "scalability" || f.category === "performance") {
        cat = "scale";
      } else {
        // architecture, maintainability, general
        cat = "arch";
      }

      // Map severity to display severity (c, h, m, l)
      let sev = "l";
      if (f.severity === "critical") sev = "c";
      else if (f.severity === "high") sev = "h";
      else if (f.severity === "medium") sev = "m";
      else if (f.severity === "low") sev = "l";

      // Find the associated line number using evidence
      let lineNum: number | null = null;
      for (const ev of (f.evidence || [])) {
        const lineMatch = ev.match(/(?:line|L)\s*(\d+)/i) || ev.match(/^(\d+)$/);
        if (lineMatch) {
          lineNum = parseInt(lineMatch[1], 10);
          break;
        }
      }

      if (!lineNum && codeLines.length > 0) {
        for (const ev of (f.evidence || [])) {
          if (ev.length > 5) {
            const matchedLine = codeLines.find(l => {
              const normCode = l.code.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").toLowerCase();
              return normCode.includes(ev.toLowerCase());
            });
            if (matchedLine) {
              lineNum = matchedLine.num;
              break;
            }
          }
        }
      }

      return {
        id: `f-${index}`,
        cat,
        sev,
        title: f.title,
        lineNum,
        rawFinding: f,
      };
    });
  }, [findings, codeLines]);

  const filteredIssues = activeCategory
    ? displayIssues.filter((i) => i.cat === activeCategory)
    : displayIssues;

  // Compute category counts dynamically
  const archCount = displayIssues.filter((i) => i.cat === "arch").length;
  const secCount = displayIssues.filter((i) => i.cat === "sec").length;
  const scaleCount = displayIssues.filter((i) => i.cat === "scale").length;

  // Dynamic Health Score computation
  const baseScore = 100;
  const totalDeduction = findings.reduce((acc, f) => {
    if (f.severity === "critical") return acc + 25;
    if (f.severity === "high") return acc + 15;
    if (f.severity === "medium") return acc + 8;
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

  return (
    <aside className="w-[240px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">
      <div className="p-[16px_14px_10px] border-b border-[var(--border)] shrink-0">
        <div className="font-hd text-[13px] font-bold text-[var(--text)] mb-[10px]">
          Issue Tracker
        </div>
        
        <HealthMeter grade={grade} score={score} status={status} />

        <div className="flex flex-col gap-[4px] mt-[10px]">
          <CategoryRow
            icon="🏛"
            name="Architectural"
            count={archCount}
            catId="arch"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("arch")}
            countClassName="bg-[rgba(26,74,138,0.12)] text-[var(--info)]"
          />
          <CategoryRow
            icon="🔴"
            name="Security"
            count={secCount}
            catId="sec"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("sec")}
            countClassName="bg-[rgba(200,68,10,0.12)] text-[var(--accent)]"
          />
          <CategoryRow
            icon="📈"
            name="Scalability"
            count={scaleCount}
            catId="scale"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("scale")}
            countClassName="bg-[rgba(200,122,10,0.12)] text-[var(--warn)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[10px_10px] flex flex-col gap-[3px]">
        {filteredIssues.length === 0 ? (
          <div className="text-[10.5px] text-[var(--muted)] font-code p-[10px] text-center">
            {isReasoning ? (
              <span className="flex items-center justify-center gap-[6px]">
                <span className="w-[8px] h-[8px] rounded-full bg-[var(--accent)] animate-ping"></span>
                Analyzing code...
              </span>
            ) : (
              "No issues found"
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => issue.lineNum && onIssueClick?.(issue.lineNum)}
              className={`flex items-start gap-[7px] p-[6px_8px] rounded-[6px] transition-colors duration-120 text-[11px] leading-[1.4] ${
                issue.lineNum 
                  ? "cursor-pointer text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]" 
                  : "text-[var(--muted)]"
              }`}
            >
              <div
                className={`w-[6px] h-[6px] rounded-full shrink-0 mt-[3px] ${severityColors[issue.sev]}`}
              />
              <span className="flex-1 font-code text-[10px]">
                {issue.title} {issue.lineNum && `(Line ${issue.lineNum})`}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="p-[10px_12px] border-t border-[var(--border)]">
        <button
          className="w-full bg-transparent border border-dashed border-[var(--border2)] text-[var(--muted)] font-code text-[10.5px] p-[7px] rounded-[6px] cursor-pointer transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.04)]"
          onClick={() => setActiveCategory(null)}
        >
          ＋ Show all
        </button>
      </div>
    </aside>
  );
});

interface CategoryRowProps {
  icon: string;
  name: string;
  count: number;
  catId: string;
  activeCategory: string | null;
  onClick: () => void;
  countClassName: string;
}

function CategoryRow({
  icon,
  name,
  count,
  catId,
  activeCategory,
  onClick,
  countClassName,
}: CategoryRowProps) {
  const isActive = activeCategory === catId;
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-[7px] p-[5px_8px] rounded-[6px] cursor-pointer transition-colors duration-120 text-[11.5px] ${
        isActive
          ? "bg-[var(--text)] text-[var(--bg)]"
          : "hover:bg-[var(--border)]"
      }`}
    >
      <span className="text-[12px]">{icon}</span>
      <span className="flex-1 font-code text-[10.5px]">{name}</span>
      <span
        className={`font-code text-[10px] font-semibold px-[6px] py-[1px] rounded-[3px] ${
          isActive
            ? "bg-[rgba(245,240,232,0.15)] text-[var(--bg)]"
            : countClassName
        }`}
      >
        {count}
      </span>
    </div>
  );
}

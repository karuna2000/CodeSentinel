import React from "react";
import { HealthMeter } from "./health-meter";

// Mock data matching the original JS findings
const mockIssues = [
  { id: "f1", cat: "arch", sev: "h", title: "Circular DI dependency" },
  { id: "f2", cat: "arch", sev: "m", title: "God object — UserService" },
  { id: "f3", cat: "arch", sev: "l", title: "Missing module boundaries" },
  { id: "f4", cat: "sec", sev: "c", title: "Hardcoded JWT secret" },
  { id: "f5", cat: "sec", sev: "c", title: "Plain-text passwords" },
  { id: "f6", cat: "sec", sev: "h", title: "No rate limiting on /login" },
  { id: "f7", cat: "sec", sev: "m", title: "Wildcard CORS" },
  { id: "f8", cat: "scale", sev: "h", title: "N+1 query pattern" },
  { id: "f9", cat: "scale", sev: "h", title: "No caching layer" },
  { id: "f10", cat: "scale", sev: "m", title: "Sync file reads" },
];

const severityColors: Record<string, string> = {
  c: "bg-[var(--danger)]",
  h: "bg-[var(--warn)]",
  m: "bg-[var(--info)]",
  l: "bg-[#888]",
};

export function IssueSidebar() {
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const filteredIssues = activeCategory
    ? mockIssues.filter((i) => i.cat === activeCategory)
    : mockIssues;

  return (
    <aside className="w-[240px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">
      <div className="p-[16px_14px_10px] border-b border-[var(--border)] shrink-0">
        <div className="font-hd text-[13px] font-bold text-[var(--text)] mb-[10px]">
          Issue Tracker
        </div>
        
        <HealthMeter />

        <div className="flex flex-col gap-[4px] mt-[10px]">
          <CategoryRow
            icon="🏛"
            name="Architectural"
            count={3}
            catId="arch"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("arch")}
            countClassName="bg-[rgba(26,74,138,0.12)] text-[var(--info)]"
          />
          <CategoryRow
            icon="🔴"
            name="Security"
            count={4}
            catId="sec"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("sec")}
            countClassName="bg-[rgba(200,68,10,0.12)] text-[var(--accent)]"
          />
          <CategoryRow
            icon="📈"
            name="Scalability"
            count={5}
            catId="scale"
            activeCategory={activeCategory}
            onClick={() => setActiveCategory("scale")}
            countClassName="bg-[rgba(200,122,10,0.12)] text-[var(--warn)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-[10px_10px] flex flex-col gap-[3px]">
        {filteredIssues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-start gap-[7px] p-[6px_8px] rounded-[6px] cursor-pointer transition-colors duration-120 text-[11px] leading-[1.4] text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
          >
            <div
              className={`w-[6px] h-[6px] rounded-full shrink-0 mt-[3px] ${severityColors[issue.sev]}`}
            />
            <span className="flex-1 font-code text-[10px]">
              {issue.title}
            </span>
          </div>
        ))}
      </div>

      <div className="p-[10px_12px] border-t border-[var(--border)]">
        <button
          className="w-full bg-transparent border border-dashed border-[var(--border2)] text-[var(--muted)] font-code text-[10.5px] p-[7px] rounded-[6px] cursor-pointer transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(200,68,10,0.04)]"
          onClick={() => setActiveCategory(null)}
        >
          ＋ New session
        </button>
      </div>
    </aside>
  );
}

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

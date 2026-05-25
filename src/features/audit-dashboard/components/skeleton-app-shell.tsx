import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonAppShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* TOPBAR */}
      <header className="h-[52px] bg-[var(--text)] flex items-center px-[20px] gap-[14px] shrink-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-[10px]">
          <Skeleton className="w-[80px] h-[24px] bg-[rgba(245,240,232,0.15)] rounded-[4px]" />
        </div>
        <div className="ml-[4px] flex items-center">
          <Skeleton className="w-[90px] h-[20px] bg-[rgba(245,240,232,0.1)] rounded-[20px]" />
        </div>
        <div className="ml-auto flex items-center gap-[10px]">
          <Skeleton className="w-[85px] h-[26px] bg-[rgba(245,240,232,0.1)] rounded-[5px]" />
          <Skeleton className="w-[100px] h-[26px] bg-[rgba(245,240,232,0.1)] rounded-[5px]" />
          <Skeleton className="w-[80px] h-[26px] bg-[rgba(245,240,232,0.1)] rounded-[5px]" />
          <Skeleton className="w-[32px] h-[32px] bg-[rgba(245,240,232,0.15)] rounded-full ml-[4px]" />
        </div>
      </header>

      {/* SHELL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* SIDEBAR SKELETON */}
        <aside className="w-[240px] shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden">
          <div className="p-[16px_14px_10px] border-b border-[var(--border)] shrink-0">
            <Skeleton className="w-[90px] h-[16px] mb-[16px]" />

            {/* HealthMeter Placeholder */}
            <div className="h-[8px] w-full bg-[rgba(245,240,232,0.04)] rounded-[4px] overflow-hidden mb-[16px]">
              <div className="h-full w-full flex">
                <Skeleton className="flex-1 h-full rounded-none" />
                <Skeleton className="flex-1 h-full rounded-none opacity-50" />
                <Skeleton className="flex-1 h-full rounded-none opacity-25" />
              </div>
            </div>

            {/* Category Rows Placeholders */}
            <div className="flex flex-col gap-[8px] mt-[10px]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-[7px] p-[5px_8px] rounded-[6px]">
                  <Skeleton className="w-[16px] h-[16px] rounded-[4px]" />
                  <Skeleton className="flex-1 h-[12px] rounded-[3px]" />
                  <Skeleton className="w-[18px] h-[14px] rounded-[3px]" />
                </div>
              ))}
            </div>
          </div>

          {/* Issue List Placeholders */}
          <div className="flex-1 p-[16px_14px] flex flex-col gap-[12px]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-start gap-[8px]">
                <Skeleton className="w-[6px] h-[6px] rounded-full shrink-0 mt-[4px]" />
                <Skeleton className="flex-1 h-[12px] rounded-[3px]" style={{ width: `${Math.random() * 40 + 40}%` }} />
              </div>
            ))}
          </div>

          {/* Bottom Button Placeholder */}
          <div className="p-[10px_12px] border-t border-[var(--border)]">
            <Skeleton className="w-full h-[28px] rounded-[6px]" />
          </div>
        </aside>

        {/* CHAT AREA SKELETON */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-[40px_10vw] flex flex-col justify-center items-center gap-[20px]">
            {/* Generic Chat Empty State / Loading State */}
            <Skeleton className="w-[64px] h-[64px] rounded-[16px] mb-[10px] opacity-70" />
            <Skeleton className="w-[200px] h-[24px] mb-[4px] opacity-80" />
            <Skeleton className="w-[300px] h-[14px] opacity-50" />
          </div>

          {/* CHAT INPUT SKELETON */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] p-[12px_20px] flex flex-col gap-[8px]">
            <div className="flex items-end gap-[10px]">
              <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-[10px] p-[10px_14px] h-[46px] flex items-center">
                <Skeleton className="w-[200px] h-[14px] opacity-40" />
              </div>
              <Skeleton className="w-[40px] h-[40px] rounded-[8px]" />
            </div>
            {/* Hint Chips Placeholders */}
            <div className="flex gap-[6px] flex-wrap mt-[2px]">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-[110px] h-[22px] rounded-[20px] opacity-60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

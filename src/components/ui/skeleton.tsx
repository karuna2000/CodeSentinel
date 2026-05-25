import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[rgba(245,240,232,0.06)] rounded ${className}`}
      {...props}
    />
  );
}

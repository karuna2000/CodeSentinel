import React, { useRef, useEffect, useState, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualItemData<T> {
  id: string;
  type: string;
  data: T;
}

interface VirtualizedChatListProps<T> {
  items: VirtualItemData<T>[];
  renderItem: (item: VirtualItemData<T>) => React.ReactNode;
  className?: string;
}

export function VirtualizedChatList<T>({ items, renderItem, className = "" }: VirtualizedChatListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // default rough estimate for chat messages
    getItemKey: (index) => items[index]?.id ?? index,
  });

  const itemsLength = items.length;

  // Track if user is at the bottom of the chat
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 80; // slightly forgiving threshold (px)
    const isBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= threshold;
    setIsAtBottom(isBottom);
  };

  // Scroll anchoring: if user was at the bottom, automatically scroll down when new content pushes height
  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (isAtBottom && itemsLength > 0 && parentRef.current) {
      // Force native scroll to bottom
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [totalSize, itemsLength, isAtBottom]);

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto ${className}`}
      style={{
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

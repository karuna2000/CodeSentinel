"use client";

import React, { useState, useEffect } from "react";

export function NetworkStatusIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="absolute top-[52px] left-0 right-0 z-50 flex justify-center pointer-events-none animate-[slideDown_0.3s_ease-out]">
      <div className="bg-[var(--danger)] text-white font-code text-[11px] font-semibold px-[16px] py-[6px] rounded-b-[8px] shadow-md flex items-center gap-[6px] pointer-events-auto">
        <span className="animate-pulse">📡</span>
        You are currently offline. Some features may be unavailable.
      </div>
    </div>
  );
}

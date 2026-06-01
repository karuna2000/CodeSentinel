"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import React, { useMemo } from "react";
import type { ChatFindingContext } from "@/types/llm-reasoning";

export interface UseFindingChatOptions {
  /** Optional finding that pre-populates the context for the first message */
  activeFinding: ChatFindingContext | null;
}

/**
 * Wraps @ai-sdk/react's `useChat` (v6 API) to power the follow-up chat feature.
 *
 * - Targets the existing /api/audit/reason endpoint with mode:'chat'
 * - Injects the active finding context into every request body via DefaultChatTransport
 * - Maintains full multi-turn conversation history automatically
 * - Uses the v6 `sendMessage` API
 */
export function useFindingChat({ activeFinding }: UseFindingChatOptions) {
  // Recreate the transport whenever the active finding changes so the body is fresh
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/audit/reason",
        body: {
          mode: "chat",
          findingContext: activeFinding ?? undefined,
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFinding?.id]
  );

  const chat = useChat({ transport });

  return chat;
}

export type FindingChatInstance = ReturnType<typeof useFindingChat>;

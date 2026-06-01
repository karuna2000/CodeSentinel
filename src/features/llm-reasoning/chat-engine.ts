import { streamText, type LanguageModel } from 'ai';
import type { ChatMessage, ChatFindingContext } from '@/types/llm-reasoning';
import { buildChatSystemPrompt, buildChatFindingContextBlock } from './chat-prompt-builder';

export interface ChatEngineOptions {
  model: LanguageModel;
}

/**
 * Runs a streaming follow-up chat turn. Sends the full conversation history
 * to the LLM, with an optional finding context prepended as a system block.
 */
export async function runChatEngine(
  messages: ChatMessage[],
  findingContext: ChatFindingContext | undefined,
  options: ChatEngineOptions,
): Promise<ReturnType<typeof streamText>> {
  const systemPrompt = buildChatSystemPrompt();

  // Build context prefix if a finding was selected
  const contextPrefix = findingContext
    ? buildChatFindingContextBlock(findingContext) + '\n\n---\n\n'
    : '';

  // Convert our ChatMessage[] into the CoreMessage format the AI SDK expects
  const coreMessages = messages.map((m, i) => {
    // Inject finding context into the first user message
    if (m.role === 'user' && i === 0 && contextPrefix) {
      return {
        role: 'user' as const,
        content: `${contextPrefix}${m.content}`,
      };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });

  try {
    const result = await streamText({
      model: options.model,
      system: systemPrompt,
      messages: coreMessages,
      temperature: 0.3,
      maxOutputTokens: 1024,
    });

    return result;
  } catch (error) {
    console.error('[ChatEngine] LLM streaming failed:', error);
    throw error;
  }
}

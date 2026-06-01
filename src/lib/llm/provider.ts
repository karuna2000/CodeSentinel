import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

export const nvidiaProvider = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: env.nvidia.apiKey,
});

export function getDefaultReasoningModel() {
  return nvidiaProvider.chat('minimaxai/minimax-m2.7');
}

export function getDefaultChatModel() {
  return nvidiaProvider.chat('minimaxai/minimax-m2.7');
}

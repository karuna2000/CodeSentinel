import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@/lib/env';

export const nvidiaProvider = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: env.nvidia.apiKey,
});

export function getDefaultReasoningModel() {
  return nvidiaProvider.chat('meta/llama-3.2-11b-vision-instruct');
}

export function getDefaultChatModel() {
  return nvidiaProvider.chat('meta/llama-3.2-11b-vision-instruct');
}

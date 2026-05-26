import { createOpenAI } from '@ai-sdk/openai';

/**
 * Configure the LLM provider using NVIDIA's API endpoint.
 * NVIDIA's endpoints are OpenAI-compatible, so we use the openai provider
 * with a custom baseURL.
 */
export const nvidiaProvider = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY || 'NVIDIA_API_KEY_MISSING',
});

/**
 * Returns the default model for reasoning tasks.
 * E.g., 'meta/llama3-70b-instruct' or 'nvidia/nemotron-4-340b-instruct'
 */
export function getDefaultReasoningModel() {
  return nvidiaProvider.chat('minimaxai/minimax-m2.7');
}

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Prioritized fallback model list on NVIDIA NIM.
 * The first model is primary; subsequent models are fallbacks.
 */
const MODEL_FALLBACKS = [
  'meta/llama-3.2-11b-vision-instruct',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
] as const;

const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
  }
  return false;
}

/**
 * Creates an OpenAI-compatible provider for NVIDIA NIM.
 */
function createNvidiaProvider(): OpenAIProvider {
  return createOpenAI({
    baseURL: BASE_URL,
    apiKey: env.nvidia.apiKey,
  });
}

/**
 * Calls an LLM operation with automatic fallback across models and
 * exponential backoff on 429 rate-limit errors.
 *
 * @param operation - A function that accepts a model and returns a result
 * @param label - Label for logging (e.g. "reasoning", "chat", "wiki")
 * @returns The result from the first successful operation
 * @throws The last error if all models and retries are exhausted
 */
export async function withResilience<T>(
  operation: (model: ReturnType<OpenAIProvider['chat']>) => T | Promise<T>,
  label: string = 'llm',
): Promise<T> {
  const provider = createNvidiaProvider();

  for (let modelIdx = 0; modelIdx < MODEL_FALLBACKS.length; modelIdx++) {
    const modelId = MODEL_FALLBACKS[modelIdx];
    const model = provider.chat(modelId);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation(model);
      } catch (error: unknown) {
        const isLastAttempt = attempt === MAX_RETRIES;
        const isLastModel = modelIdx === MODEL_FALLBACKS.length - 1;

        if (isRateLimited(error) && !isLastAttempt) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
          logger.warn(
            `[Resilience/${label}]`,
            `Rate limited on ${modelId} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), backing off ${backoffMs}ms`,
          );
          await sleep(backoffMs);
          continue;
        }

        if (isRateLimited(error) && !isLastModel) {
          logger.warn(
            `[Resilience/${label}]`,
            `Rate limited on ${modelId} after ${MAX_RETRIES + 1} attempts, falling back to next model`,
          );
          break; // break inner loop → next model
        }

        // Non-rate-limit error or exhausted all options
        logger.error(
          `[Resilience/${label}]`,
          `Failed on ${modelId} (attempt ${attempt + 1})`,
          { error: error instanceof Error ? error.message : String(error) },
        );

        if (!isLastAttempt && !isRateLimited(error)) {
          // For non-429 errors, still retry with backoff (transient failures)
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }

        if (isLastModel && isLastAttempt) {
          throw error;
        }
      }
    }
  }

  throw new Error(`[Resilience/${label}] All models exhausted`);
}

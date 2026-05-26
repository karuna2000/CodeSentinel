import { streamObject, type LanguageModel, type StreamObjectResult } from 'ai';
import { ReasoningOutputSchema, type ReasoningOutput } from '@/types/llm-reasoning';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';
import { buildReasoningContext } from './context-builder';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder';

export interface ReasoningOptions {
  /** The LLM model instance (e.g. from @ai-sdk/openai) */
  model: LanguageModel;
  /** The specific task, e.g., "comprehensive code review", "security audit" */
  task?: string;
}

/**
 * Runs the Grounded LLM Reasoning Engine.
 * 
 * This orchestrator:
 * 1. Builds the reasoning context from the deterministic understanding.
 * 2. Constructs the system and user prompts.
 * 3. Calls the LLM using structured output generation.
 * 4. Normalizes and validates the response.
 *
 * @param understanding The output from the Code Understanding Agent
 * @param content The raw code content
 * @param options Configuration options, including the LLM model
 * @returns The stream object result to be piped to the client
 */
export async function runReasoningEngine(
  understanding: CodeUnderstandingOutput,
  content: string,
  options: ReasoningOptions
): Promise<any> {
  const task = options.task || 'comprehensive code review';
  
  // 1. Build context
  const context = buildReasoningContext(understanding, content);

  // 2. Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context, task);

  try {
    // 3. Call LLM for streaming structured output
    const result = await streamObject({
      model: options.model,
      schema: ReasoningOutputSchema,
      system: systemPrompt,
      prompt: userPrompt,
      // Ensure the model doesn't drift too far into creative hallucination
      temperature: 0.1, 
    });

    return result;
  } catch (error) {
    console.error('[ReasoningEngine] LLM streaming failed:', error);
    throw error;
  }
}

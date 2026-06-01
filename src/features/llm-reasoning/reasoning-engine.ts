import { streamObject, type LanguageModel, type StreamObjectResult } from 'ai';
import { ReasoningOutputSchema, type ReasoningOutput } from '@/types/llm-reasoning';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';
import { buildReasoningContext } from './context-builder';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder';

export interface ReasoningOptions {
  
  model: LanguageModel;
  
  task?: string;
}

export async function runReasoningEngine(
  understanding: CodeUnderstandingOutput,
  content: string,
  options: ReasoningOptions
): Promise<any> {
  const task = options.task || 'comprehensive code review';
  
  
  const context = buildReasoningContext(understanding, content);

  
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context, task);

  try {
    
    const result = await streamObject({
      model: options.model,
      schema: ReasoningOutputSchema,
      system: systemPrompt,
      prompt: userPrompt,
      
      temperature: 0.1, 
    });

    return result;
  } catch (error) {
    console.error('[ReasoningEngine] LLM streaming failed:', error);
    throw error;
  }
}

import { describe, it, expect, vi } from 'vitest';
import { runReasoningEngine } from '@/features/llm-reasoning/reasoning-engine';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';
import type { LanguageModelV1 } from '@ai-sdk/provider';

const mockUnderstanding: CodeUnderstandingOutput = {
  language: { name: 'TypeScript', confidence: 0.99, detectedVia: 'extension' },
  framework: null,
  runtime: null,
  artifactType: null,
  dependencies: [],
  architecturalSignals: [],
  overallConfidence: 0.9,
  requiresClarification: false,
  clarificationQuestions: [],
  summary: 'Generic TypeScript code',
  versionGrounding: null
};

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamObject: vi.fn(),
  };
});

import { streamObject } from 'ai';

describe('Reasoning Engine', () => {
  const dummyModel = {} as LanguageModelV1;

  it('calls the LLM and returns a stream object result', async () => {
    vi.mocked(streamObject).mockResolvedValueOnce({
      toTextStreamResponse: () => new Response('mock stream')
    } as any);

    const result = await runReasoningEngine(mockUnderstanding, 'const API_KEY = "12345";', {
      model: dummyModel
    });

    expect(result).toBeDefined();
    expect(typeof result.toTextStreamResponse).toBe('function');
  });

  it('throws error when streaming fails', async () => {
    vi.mocked(streamObject).mockRejectedValueOnce(new Error('LLM API Error'));

    await expect(runReasoningEngine(mockUnderstanding, 'test', { model: dummyModel })).rejects.toThrow('LLM API Error');
  });
});

import { describe, it, expect } from 'vitest';
import { buildReasoningContext, formatContextForPrompt } from '@/features/llm-reasoning/context-builder';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';

const mockUnderstanding: CodeUnderstandingOutput = {
  language: { name: 'TypeScript', confidence: 0.99, detectedVia: 'extension' },
  framework: { name: 'Next.js', confidence: 0.9, signals: [] },
  runtime: { type: 'node', confidence: 0.8, signals: [] },
  artifactType: { type: 'api-route', confidence: 0.9, },
  dependencies: ['react', 'next'],
  architecturalSignals: [
    { name: 'database', evidence: 'import { prisma }' }
  ],
  overallConfidence: 0.9,
  requiresClarification: false,
  clarificationQuestions: [],
  summary: 'A Next.js API Route in TypeScript',
  versionGrounding: {
    frameworks: [
      {
        framework: 'Next.js',
        versionInference: { label: 'Next.js 13–14.x (App Router)', minVersion: '13.0', maxVersion: '14.x', confidence: 0.9, signals: [] },
        apiPatterns: [
          { api: '"use client"', framework: 'Next.js', introducedInVersion: '13.0', description: 'Marks component tree as client-side', deprecatedInVersion: null }
        ],
        groundingSources: [
          { label: 'Next.js Docs', url: 'https://nextjs.org/docs', priority: 1, purpose: 'Official docs' }
        ],
        versionClarificationQuestions: []
      }
    ],
    detectedApiPatterns: [
      { api: '"use client"', framework: 'Next.js', introducedInVersion: '13.0', description: 'Marks component tree as client-side', deprecatedInVersion: null }
    ],
    requiresVersionClarification: false,
    versionClarificationQuestions: [],
    groundingSources: [
      { label: 'Next.js Docs', url: 'https://nextjs.org/docs', priority: 1, purpose: 'Official docs' }
    ],
    groundingSummary: 'Next.js 13–14.x (App Router) — 1 grounding source ready'
  }
};

describe('Context Builder', () => {
  it('buildReasoningContext maps fields correctly', () => {
    const code = 'const x = 1;';
    const ctx = buildReasoningContext(mockUnderstanding, code);

    expect(ctx.understandingSummary).toBe('A Next.js API Route in TypeScript');
    expect(ctx.framework).toBe('Next.js');
    expect(ctx.runtime).toBe('node');
    expect(ctx.artifactType).toBe('api-route');
    expect(ctx.dependencies).toEqual(['react', 'next']);
    expect(ctx.architecturalSignals).toEqual(['database (Evidence: import { prisma })']);
    expect(ctx.versionInferences).toEqual(['Next.js: Next.js 13–14.x (App Router)']);
    expect(ctx.apiPatterns.length).toBe(1);
    expect(ctx.apiPatterns[0]).toContain('[Next.js] "use client" (Introduced: 13.0) - Marks component tree as client-side');
    expect(ctx.groundingSources.length).toBe(1);
    expect(ctx.groundingSources[0]).toBe('Next.js Docs - https://nextjs.org/docs (Official docs)');
    expect(ctx.codeContent).toBe(code);
  });

  it('formatContextForPrompt formats into a readable string', () => {
    const code = 'const x = 1;';
    const ctx = buildReasoningContext(mockUnderstanding, code);
    const formatted = formatContextForPrompt(ctx);

    expect(formatted).toContain('[DETERMINISTIC UNDERSTANDING]');
    expect(formatted).toContain('Framework: Next.js');
    expect(formatted).toContain('[ARCHITECTURAL SIGNALS]');
    expect(formatted).toContain('database (Evidence: import { prisma })');
    expect(formatted).toContain('[VERSION GROUNDING]');
    expect(formatted).toContain('Next.js: Next.js 13–14.x (App Router)');
    expect(formatted).toContain('Next.js Docs - https://nextjs.org/docs');
  });

  it('handles null version grounding', () => {
    const understandingWithoutGrounding = { ...mockUnderstanding, versionGrounding: null };
    const ctx = buildReasoningContext(understandingWithoutGrounding, 'code');
    
    expect(ctx.versionInferences).toEqual([]);
    expect(ctx.apiPatterns).toEqual([]);
    expect(ctx.groundingSources).toEqual([]);
    
    const formatted = formatContextForPrompt(ctx);
    expect(formatted).toContain('Inferred Versions:\n- None');
  });
});

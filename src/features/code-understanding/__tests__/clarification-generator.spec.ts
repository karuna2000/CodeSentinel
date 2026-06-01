

import { describe, it, expect } from 'vitest';
import {
  generateClarificationQuestions,
  MAX_QUESTIONS,
} from '@/features/code-understanding/pipeline/clarification-generator';
import type { QuestionContext } from '@/features/code-understanding/pipeline/clarification-generator';

const HIGH_LANG = { name: 'TypeScript', confidence: 0.98, detectedVia: 'extension' as const };
const UNKNOWN_LANG = { name: 'Unknown', confidence: 0.10, detectedVia: 'fallback' as const };
const MID_LANG = { name: 'JavaScript', confidence: 0.60, detectedVia: 'keyword' as const };

describe('generateClarificationQuestions — no questions when confident', () => {
  it('returns empty array when requiresClarification is false', () => {
    const ctx: QuestionContext = {
      language: HIGH_LANG,
      framework: { name: 'Next.js', confidence: 0.92, signals: [] },
      runtime: { type: 'node', confidence: 0.88, signals: [] },
      artifactType: { type: 'api-route', confidence: 0.90 },
      signals: [],
      overallConfidence: 0.93,
      requiresClarification: false,
    };
    const questions = generateClarificationQuestions(ctx);
    expect(questions).toHaveLength(0);
  });
});

describe('generateClarificationQuestions — low language confidence', () => {
  it('asks about language when language confidence is below 0.55', () => {
    const ctx: QuestionContext = {
      language: UNKNOWN_LANG,
      framework: null,
      runtime: null,
      artifactType: null,
      signals: [],
      overallConfidence: 0.25,
      requiresClarification: true,
    };
    const questions = generateClarificationQuestions(ctx);
    const hasLangQuestion = questions.some((q) =>
      q.question.toLowerCase().includes('language'),
    );
    expect(hasLangQuestion).toBe(true);
  });
});

describe('generateClarificationQuestions — missing framework for TS/JS', () => {
  it('asks about framework when framework is null for TypeScript code', () => {
    const ctx: QuestionContext = {
      language: HIGH_LANG,
      framework: null,
      runtime: null,
      artifactType: null,
      signals: [],
      overallConfidence: 0.50,
      requiresClarification: true,
    };
    const questions = generateClarificationQuestions(ctx);
    const hasFrameworkQuestion = questions.some((q) =>
      q.question.toLowerCase().includes('framework'),
    );
    expect(hasFrameworkQuestion).toBe(true);
  });
});

describe('generateClarificationQuestions — ambiguous runtime', () => {
  it('asks about runtime when runtime is null', () => {
    const ctx: QuestionContext = {
      language: MID_LANG,
      framework: null,
      runtime: null,
      artifactType: null,
      signals: [],
      overallConfidence: 0.45,
      requiresClarification: true,
    };
    const questions = generateClarificationQuestions(ctx);
    const hasRuntimeQuestion = questions.some((q) =>
      q.question.toLowerCase().includes('browser') ||
      q.question.toLowerCase().includes('server') ||
      q.question.toLowerCase().includes('runtime'),
    );
    expect(hasRuntimeQuestion).toBe(true);
  });
});

describe('generateClarificationQuestions — max cap', () => {
  it('never returns more than MAX_QUESTIONS', () => {
    const ctx: QuestionContext = {
      language: UNKNOWN_LANG,
      framework: null,
      runtime: null,
      artifactType: null,
      signals: [{ name: 'authentication', evidence: 'jwt import' }],
      overallConfidence: 0.10,
      requiresClarification: true,
    };
    const questions = generateClarificationQuestions(ctx);
    expect(questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('MAX_QUESTIONS constant is 3', () => {
    expect(MAX_QUESTIONS).toBe(3);
  });
});

describe('generateClarificationQuestions — question structure', () => {
  it('each question has a non-empty question and reason', () => {
    const ctx: QuestionContext = {
      language: UNKNOWN_LANG,
      framework: null,
      runtime: null,
      artifactType: null,
      signals: [],
      overallConfidence: 0.20,
      requiresClarification: true,
    };
    const questions = generateClarificationQuestions(ctx);
    for (const q of questions) {
      expect(typeof q.question).toBe('string');
      expect(q.question.length).toBeGreaterThan(0);
      expect(typeof q.reason).toBe('string');
      expect(q.reason.length).toBeGreaterThan(0);
    }
  });
});

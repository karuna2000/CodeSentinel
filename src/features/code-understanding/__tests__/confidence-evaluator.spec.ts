/**
 * Tests for the Confidence Evaluator.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateConfidence,
  formatConfidence,
  CLARIFICATION_THRESHOLD,
} from '@/features/code-understanding/pipeline/confidence-evaluator';
import type { LanguageDetection, FrameworkDetection, RuntimeDetection, ArtifactTypeDetection } from '@/types/code-understanding';

const HIGH_LANG: LanguageDetection = { name: 'TypeScript', confidence: 0.98, detectedVia: 'extension' };
const HIGH_FRAMEWORK: FrameworkDetection = { name: 'Next.js', confidence: 0.92, signals: ['next/* import'] };
const HIGH_RUNTIME: RuntimeDetection = { type: 'node', confidence: 0.88, signals: ['fs import'] };
const HIGH_ARTIFACT: ArtifactTypeDetection = { type: 'api-route', confidence: 0.90 };

const LOW_LANG: LanguageDetection = { name: 'Unknown', confidence: 0.10, detectedVia: 'fallback' };

describe('evaluateConfidence — high confidence scenario', () => {
  it('computes high overall confidence when all detections are strong', () => {
    const result = evaluateConfidence(HIGH_LANG, HIGH_FRAMEWORK, HIGH_RUNTIME, HIGH_ARTIFACT);
    expect(result.overallConfidence).toBeGreaterThan(0.88);
    expect(result.requiresClarification).toBe(false);
  });

  it('does not require clarification above threshold', () => {
    const result = evaluateConfidence(HIGH_LANG, HIGH_FRAMEWORK, HIGH_RUNTIME, HIGH_ARTIFACT);
    expect(result.requiresClarification).toBe(false);
  });
});

describe('evaluateConfidence — low confidence scenario', () => {
  it('requires clarification when language is unknown and others are null', () => {
    const result = evaluateConfidence(LOW_LANG, null, null, null);
    expect(result.requiresClarification).toBe(true);
    expect(result.overallConfidence).toBeLessThan(CLARIFICATION_THRESHOLD);
  });

  it('requires clarification when only language has moderate confidence and rest are null', () => {
    const midLang: LanguageDetection = { name: 'JavaScript', confidence: 0.60, detectedVia: 'keyword' };
    const result = evaluateConfidence(midLang, null, null, null);
    // 0.60 * 0.35 + 0.35 * (0.25 + 0.20 + 0.20) = 0.21 + 0.2275 = 0.4375 → < 0.65
    expect(result.requiresClarification).toBe(true);
  });
});

describe('evaluateConfidence — absent detections', () => {
  it('applies absent confidence (0.35) for null framework', () => {
    const result = evaluateConfidence(HIGH_LANG, null, HIGH_RUNTIME, HIGH_ARTIFACT);
    // Should still be decent but lower than all-high
    const allHighResult = evaluateConfidence(HIGH_LANG, HIGH_FRAMEWORK, HIGH_RUNTIME, HIGH_ARTIFACT);
    expect(result.overallConfidence).toBeLessThan(allHighResult.overallConfidence);
  });

  it('provides breakdown with correct language score', () => {
    const result = evaluateConfidence(HIGH_LANG, null, null, null);
    expect(result.breakdown.language).toBe(0.98);
    expect(result.breakdown.framework).toBe(0.35); // absent default
    expect(result.breakdown.runtime).toBe(0.35);
    expect(result.breakdown.artifactType).toBe(0.35);
  });
});

describe('evaluateConfidence — edge cases', () => {
  it('caps confidence at 1.0', () => {
    const perfectLang: LanguageDetection = { name: 'TypeScript', confidence: 1.0, detectedVia: 'extension' };
    const perfectFw: FrameworkDetection = { name: 'Next.js', confidence: 1.0, signals: [] };
    const perfectRt: RuntimeDetection = { type: 'node', confidence: 1.0, signals: [] };
    const perfectAt: ArtifactTypeDetection = { type: 'api-route', confidence: 1.0 };
    const result = evaluateConfidence(perfectLang, perfectFw, perfectRt, perfectAt);
    expect(result.overallConfidence).toBeLessThanOrEqual(1.0);
  });

  it('clarification threshold constant is 0.65', () => {
    expect(CLARIFICATION_THRESHOLD).toBe(0.65);
  });
});

describe('formatConfidence', () => {
  it('formats 0.82 as "82%"', () => {
    expect(formatConfidence(0.82)).toBe('82%');
  });

  it('formats 1.0 as "100%"', () => {
    expect(formatConfidence(1.0)).toBe('100%');
  });

  it('formats 0.0 as "0%"', () => {
    expect(formatConfidence(0.0)).toBe('0%');
  });
});

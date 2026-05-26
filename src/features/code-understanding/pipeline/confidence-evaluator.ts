/**
 * Confidence Evaluator — aggregates per-detection confidence scores into an
 * overall confidence value and determines whether clarification is required.
 *
 * Weighting:
 *  - Language detection:  35% (most fundamental)
 *  - Framework detection: 25% (important but optional)
 *  - Runtime detection:   20% (contextual)
 *  - Artifact type:       20% (role classification)
 *
 * When a detection is absent (null), its slot contributes a low default
 * of 0.35 to reflect genuine uncertainty — we don't pretend certainty.
 *
 * Threshold:
 *  - overall < 0.65 → requiresClarification = true
 *
 * Design:
 *  - Pure function, no side effects
 *  - All inputs are optional — handles partial pipeline results gracefully
 */

import type {
  LanguageDetection,
  FrameworkDetection,
  RuntimeDetection,
  ArtifactTypeDetection,
} from '@/types/code-understanding';

// ---------------------------------------------------------------------------
// Weighting constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  language: 0.35,
  framework: 0.25,
  runtime: 0.20,
  artifactType: 0.20,
} as const;

/** Confidence assigned when a detection is absent (null) */
const ABSENT_CONFIDENCE = 0.35;

/** Below this threshold we request clarification from the user */
export const CLARIFICATION_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ConfidenceEvaluation {
  overallConfidence: number;
  requiresClarification: boolean;
  /** Per-component breakdown for debugging / display */
  breakdown: {
    language: number;
    framework: number;
    runtime: number;
    artifactType: number;
  };
}

/**
 * Computes an aggregate confidence score across all detection components.
 *
 * @param language     Language detection result
 * @param framework    Framework detection result (nullable)
 * @param runtime      Runtime detection result (nullable)
 * @param artifactType Artifact type classification (nullable)
 */
export function evaluateConfidence(
  language: LanguageDetection,
  framework: FrameworkDetection | null,
  runtime: RuntimeDetection | null,
  artifactType: ArtifactTypeDetection | null,
): ConfidenceEvaluation {
  const langScore = language.confidence;
  const frameworkScore = framework?.confidence ?? ABSENT_CONFIDENCE;
  const runtimeScore = runtime?.confidence ?? ABSENT_CONFIDENCE;
  const artifactScore = artifactType?.confidence ?? ABSENT_CONFIDENCE;

  const overallConfidence =
    langScore * WEIGHTS.language +
    frameworkScore * WEIGHTS.framework +
    runtimeScore * WEIGHTS.runtime +
    artifactScore * WEIGHTS.artifactType;

  return {
    overallConfidence: Math.min(1.0, parseFloat(overallConfidence.toFixed(3))),
    requiresClarification: overallConfidence < CLARIFICATION_THRESHOLD,
    breakdown: {
      language: langScore,
      framework: frameworkScore,
      runtime: runtimeScore,
      artifactType: artifactScore,
    },
  };
}

/**
 * Formats a confidence score as a human-readable percentage string.
 * e.g. 0.82 → "82%"
 */
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

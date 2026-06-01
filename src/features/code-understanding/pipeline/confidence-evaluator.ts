

import type {
  LanguageDetection,
  FrameworkDetection,
  RuntimeDetection,
  ArtifactTypeDetection,
} from '@/types/code-understanding';

const WEIGHTS = {
  language: 0.35,
  framework: 0.25,
  runtime: 0.20,
  artifactType: 0.20,
} as const;

const ABSENT_CONFIDENCE = 0.35;

export const CLARIFICATION_THRESHOLD = 0.65;

export interface ConfidenceEvaluation {
  overallConfidence: number;
  requiresClarification: boolean;
  
  breakdown: {
    language: number;
    framework: number;
    runtime: number;
    artifactType: number;
  };
}

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

export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Code Understanding Agent — Structured Output Types
 *
 * Defines the complete machine-readable output produced by the
 * Code Understanding Agent after analysing an InputArtifact.
 *
 * Design principles:
 *  - Every major detection carries an explicit confidence score (0–1)
 *  - Nullable detections reflect genuine uncertainty rather than assumptions
 *  - Clarification questions are generated when confidence is insufficient
 *  - This output becomes the shared context for all downstream analysis agents
 */

import type { VersionGroundingOutput } from './version-grounding';

// ---------------------------------------------------------------------------
// Detection primitives
// ---------------------------------------------------------------------------

/** A detected language with confidence level */
export interface LanguageDetection {
  /** Canonical language name, e.g. "TypeScript", "Python", "Go" */
  name: string;
  /** Confidence in [0, 1]. 1 = certain (e.g. unambiguous extension + syntax). */
  confidence: number;
  /** The primary signal that drove detection */
  detectedVia: 'extension' | 'syntax-heuristic' | 'shebang' | 'keyword' | 'fallback';
}

/** A detected framework or runtime ecosystem */
export interface FrameworkDetection {
  /** Framework name, e.g. "Next.js", "Express", "FastAPI" */
  name: string;
  /** Confidence in [0, 1] */
  confidence: number;
  /** Import/pattern signals that triggered this detection */
  signals: string[];
}

/** A detected execution environment / runtime target */
export interface RuntimeDetection {
  /**
   * Execution environment type.
   * 'browser' | 'node' | 'edge' | 'serverless' | 'cli' | 'middleware' | 'unknown'
   */
  type: string;
  /** Confidence in [0, 1] */
  confidence: number;
  /** Code patterns that indicated this runtime */
  signals: string[];
}

/** A probabilistic classification of what the file represents */
export interface ArtifactTypeDetection {
  /**
   * Artifact role. Examples:
   * 'react-component' | 'api-route' | 'middleware' | 'hook' | 'context-provider'
   * | 'schema-model' | 'utility' | 'config' | 'auth-module' | 'database-layer'
   * | 'test-file' | 'unknown'
   */
  type: string;
  /** Confidence in [0, 1] */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Architectural signals
// ---------------------------------------------------------------------------

/**
 * Named architectural indicator found in the code.
 * These become downstream context for security/scalability analysis agents.
 */
export type ArchitecturalSignalName =
  | 'authentication'
  | 'database'
  | 'caching'
  | 'middleware'
  | 'async-boundary'
  | 'api-call'
  | 'state-management'
  | 'env-variable'
  | 'websocket'
  | 'filesystem-access'
  | 'error-handling'
  | 'logging'
  | 'rate-limiting'
  | 'cors'
  | 'encryption';

export interface ArchitecturalSignal {
  name: ArchitecturalSignalName;
  /** Evidence string (e.g. the import or pattern that triggered this) */
  evidence: string;
}

// ---------------------------------------------------------------------------
// Clarification questions
// ---------------------------------------------------------------------------

export interface ClarificationQuestion {
  /** Short human-readable question */
  question: string;
  /**
   * Why this is being asked — helps the user understand intent.
   * e.g. "This helps determine whether auth is server-side."
   */
  reason: string;
}

// ---------------------------------------------------------------------------
// Top-level output
// ---------------------------------------------------------------------------

/**
 * The complete structured output returned by the Code Understanding Agent.
 *
 * Consumed by:
 *  - ProcessingResult (attached to every processed artifact)
 *  - Downstream analysis agents (architecture, security, scalability, quality)
 *  - UI components (InputArtifactCard metadata, audit panels)
 */
export interface CodeUnderstandingOutput {
  /** Detected programming language (always present, may have low confidence) */
  language: LanguageDetection;

  /**
   * Detected framework/runtime ecosystem.
   * Null when no framework signals are found.
   */
  framework: FrameworkDetection | null;

  /**
   * Inferred execution environment.
   * Null when signals are insufficient to determine runtime.
   */
  runtime: RuntimeDetection | null;

  /**
   * Probabilistic classification of what role this file plays.
   * Null when the classifier is not confident enough to commit to a type.
   */
  artifactType: ArtifactTypeDetection | null;

  /**
   * Extracted import/dependency names (deduped, order-preserved by first appearance).
   * Includes both external packages and relative internal imports.
   */
  dependencies: string[];

  /**
   * Named architectural signals detected in the code.
   * Each signal includes evidence for transparency.
   */
  architecturalSignals: ArchitecturalSignal[];

  /**
   * Aggregate confidence across all detections.
   * Computed as a weighted average of individual detection scores.
   * Falls below 0.65 → requiresClarification = true.
   */
  overallConfidence: number;

  /**
   * True when the agent cannot proceed with high enough confidence and
   * needs additional context from the user.
   */
  requiresClarification: boolean;

  /**
   * Clarification questions to present to the user when requiresClarification is true.
   * Maximum 3 questions — ordered by importance.
   */
  clarificationQuestions: ClarificationQuestion[];

  /**
   * One-line human-readable summary of what the agent understood.
   * e.g. "A Next.js App Router route handler (TypeScript, backend, 82% confidence)"
   */
  summary: string;

  /**
   * Framework version detection and knowledge grounding output.
   *
   * Contains:
   *  - Inferred version ranges for all detected frameworks
   *  - Specific versioned API patterns found in the code
   *  - Grounding source URLs to fetch before LLM reasoning
   *  - Version clarification questions when version is uncertain
   *
   * Null when no frameworks were detected or the grounding pipeline
   * was not yet executed.
   */
  versionGrounding: VersionGroundingOutput | null;
}

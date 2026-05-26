/**
 * Version Grounding Types — structured output for framework/library version
 * detection and knowledge grounding.
 *
 * These types extend the Code Understanding Agent's output with version-aware
 * context that downstream analysis agents can use to avoid stale-knowledge
 * reasoning (LLM hallucinations based on outdated training data).
 *
 * Design principles:
 *  - Every version inference carries a confidence score (0–1)
 *  - Detected signals are kept for transparency
 *  - The grounding context includes curated knowledge-base URLs
 *    so retrieval tools can fetch current docs before reasoning
 *  - Clarification questions are generated when version uncertainty is high
 */

// ---------------------------------------------------------------------------
// Version inference
// ---------------------------------------------------------------------------

/**
 * Inferred major/minor version range for a detected framework/library.
 * Uses a range rather than an exact version to reflect realistic uncertainty
 * from code-only analysis (no package.json available).
 */
export interface VersionInference {
  /**
   * Minimum inferred version, e.g. "18.0" (React 18+).
   * Null when no lower bound can be determined.
   */
  minVersion: string | null;

  /**
   * Maximum inferred version, e.g. "18.x".
   * Null when no upper bound can be determined.
   */
  maxVersion: string | null;

  /**
   * Human-readable description of the inferred range.
   * e.g. "React 18.x" | "Next.js 13+ (App Router era)" | "Express 4.x"
   */
  label: string;

  /** Confidence in [0, 1] */
  confidence: number;

  /**
   * Signal evidence list — the specific code patterns that justified
   * this version inference. e.g. ["useTransition() hook (React 18+)"]
   */
  signals: string[];
}

// ---------------------------------------------------------------------------
// API-pattern match
// ---------------------------------------------------------------------------

/**
 * A specific API usage pattern that indicates a minimum framework version
 * and may require version-specific knowledge for correct analysis.
 */
export interface ApiPatternMatch {
  /** The API name / pattern, e.g. "useTransition", "\"use client\" directive" */
  api: string;
  /** Framework the API belongs to */
  framework: string;
  /** Minimum version this API was introduced, e.g. "18.0" */
  introducedInVersion: string;
  /** One-line description of what this API does */
  description: string;
  /**
   * Indicates this API was deprecated at some version.
   * Null when the API is still current.
   */
  deprecatedInVersion: string | null;
}

// ---------------------------------------------------------------------------
// Knowledge grounding context
// ---------------------------------------------------------------------------

/**
 * Curated knowledge grounding entry for a framework+version combination.
 * Provides structured pointers so retrieval tools know WHERE to fetch
 * current documentation before reasoning starts.
 *
 * This layer is the anti-hallucination backbone:
 * instead of the LLM guessing, the platform retrieves grounded context.
 */
export interface GroundingSource {
  /** Source label for humans, e.g. "React 18 Changelog" */
  label: string;
  /** Canonical URL to fetch before reasoning */
  url: string;
  /**
   * Priority tier:
   *  1 = primary (official docs / release notes — fetch first)
   *  2 = secondary (migration guides, RFCs)
   *  3 = supplementary (community, MDN)
   */
  priority: 1 | 2 | 3;
  /** What this source helps reason about */
  purpose: string;
}

// ---------------------------------------------------------------------------
// Grounded framework entry
// ---------------------------------------------------------------------------

/**
 * Combined per-framework version detection + grounding context.
 * One entry is produced for each detected framework/library.
 */
export interface FrameworkVersionGrounding {
  /** Framework/library name, e.g. "Next.js", "React", "Prisma" */
  framework: string;

  /** Inferred version range from code signals */
  versionInference: VersionInference;

  /** Specific modern API patterns matched in the code */
  apiPatterns: ApiPatternMatch[];

  /**
   * Curated grounding sources to fetch before reasoning about this framework.
   * Ordered by priority (1 first).
   */
  groundingSources: GroundingSource[];

  /**
   * Clarification questions specifically about this framework's version.
   * Generated when version confidence is below threshold.
   */
  versionClarificationQuestions: string[];
}

// ---------------------------------------------------------------------------
// Top-level version grounding output
// ---------------------------------------------------------------------------

/**
 * The complete version grounding output produced by the version detection
 * pipeline. Attached to CodeUnderstandingOutput.versionGrounding.
 *
 * Consumed by:
 *  - Downstream analysis agents (security, scalability, quality)
 *  - MCP tool orchestrator (knows which docs to fetch)
 *  - Prompt builder (injects grounded context before LLM reasoning)
 */
export interface VersionGroundingOutput {
  /**
   * Per-framework version detection + grounding context.
   * Includes the primary detected framework and all significant
   * library dependencies (e.g. Prisma, Redis, Zod).
   */
  frameworks: FrameworkVersionGrounding[];

  /**
   * All unique API patterns matched across all frameworks.
   * Useful for quick scanning of "what modern APIs are in use".
   */
  detectedApiPatterns: ApiPatternMatch[];

  /**
   * Whether any detected framework/library has version uncertainty
   * high enough to warrant clarification.
   */
  requiresVersionClarification: boolean;

  /**
   * Combined version clarification questions from all frameworks.
   * De-duplicated and ordered by importance.
   * Max 3 total questions.
   */
  versionClarificationQuestions: string[];

  /**
   * All unique grounding sources across all detected frameworks,
   * deduplicated and sorted by priority.
   * This is the retrieval queue for knowledge grounding.
   */
  groundingSources: GroundingSource[];

  /**
   * One-line human-readable grounding summary.
   * e.g. "Next.js 13+ App Router, React 18.x, Prisma 5.x — grounding sources ready"
   */
  groundingSummary: string;
}

/**
 * Version Grounding Orchestrator — top-level entry point for the
 * framework version detection and knowledge grounding pipeline.
 *
 * Drives all version-grounding sub-stages:
 *  1. Per-framework version inference (from code signals)
 *  2. API pattern matching (which specific versioned APIs are used)
 *  3. Grounding source assembly (which docs to fetch before reasoning)
 *  4. Version clarification question generation
 *  5. Summary synthesis
 *
 * This orchestrator is designed to run AFTER the Code Understanding Agent
 * and uses its output (detected frameworks + dependencies) as input.
 *
 * Design:
 *  - Pure function — takes a list of detected framework names + code content
 *  - No side effects, no LLM calls, no network calls
 *  - Each stage is wrapped in safeRun() for resilience
 *  - Returns VersionGroundingOutput ready for downstream agents
 *
 * Anti-hallucination role:
 *  The output.groundingSources list is the "retrieval queue" that MCP tools
 *  or web search should consume BEFORE the LLM reasons about the code.
 *  This ensures the LLM reasons with current docs, not stale training memory.
 */

import type { VersionGroundingOutput, FrameworkVersionGrounding } from '@/types/version-grounding';
import { inferVersion, matchApiPatterns } from './version-signal-extractor';
import { buildGroundingSources, mergeGroundingSources } from './grounding-context-builder';
import { generateVersionClarificationQuestions, VERSION_CLARIFICATION_THRESHOLD } from './version-clarification-generator';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full version grounding pipeline over a set of detected frameworks.
 *
 * @param detectedFrameworks  Framework names from the Code Understanding Agent
 *                            (primary + secondary library detections, e.g. ["Next.js", "Prisma"])
 * @param content             Full code content of the artifact
 * @returns                   VersionGroundingOutput with version inferences,
 *                            API patterns, and grounding sources
 */
export function runVersionGrounding(
  detectedFrameworks: string[],
  content: string,
): VersionGroundingOutput {
  if (detectedFrameworks.length === 0) {
    return emptyOutput();
  }

  // ─── Stage 1: Per-framework version inference ────────────────────────────
  const frameworkVersionings: FrameworkVersionGrounding[] = detectedFrameworks
    .map((framework) => {
      const versionInference = safeRun(
        () => inferVersion(framework, content),
        {
          minVersion: null,
          maxVersion: null,
          label: `${framework} (version unknown)`,
          confidence: 0.20,
          signals: [],
        },
      );

      // ─── Stage 2: API pattern matching ──────────────────────────────────
      const apiPatterns = safeRun(
        () => matchApiPatterns(framework, content),
        [],
      );

      // ─── Stage 3: Grounding source assembly ─────────────────────────────
      const groundingSources = safeRun(
        () => buildGroundingSources(framework, versionInference.label),
        [],
      );

      // ─── Stage 4: Per-framework clarification questions ──────────────────
      const versionClarificationQuestions = safeRun(
        () =>
          generateVersionClarificationQuestions([
            {
              framework,
              confidence: versionInference.confidence,
              versionLabel: versionInference.label,
            },
          ]),
        [],
      );

      return {
        framework,
        versionInference,
        apiPatterns,
        groundingSources,
        versionClarificationQuestions,
      };
    });

  // ─── Stage 5: Aggregate API patterns ────────────────────────────────────
  const allApiPatterns = dedupApiPatterns(
    frameworkVersionings.flatMap((f) => f.apiPatterns),
  );

  // ─── Stage 6: Merge grounding sources ───────────────────────────────────
  const mergedSources = safeRun(
    () => mergeGroundingSources(frameworkVersionings.map((f) => f.groundingSources)),
    [],
  );

  // ─── Stage 7: Aggregate clarification questions ──────────────────────────
  const allVersionQuestions = dedupStrings(
    frameworkVersionings.flatMap((f) => f.versionClarificationQuestions),
  ).slice(0, 2); // global max of 2 version clarification questions

  const requiresVersionClarification =
    allVersionQuestions.length > 0 ||
    frameworkVersionings.some(
      (f) => f.versionInference.confidence < VERSION_CLARIFICATION_THRESHOLD,
    );

  // ─── Stage 8: Summary ────────────────────────────────────────────────────
  const groundingSummary = buildGroundingSummary(frameworkVersionings);

  return {
    frameworks: frameworkVersionings,
    detectedApiPatterns: allApiPatterns,
    requiresVersionClarification,
    versionClarificationQuestions: allVersionQuestions,
    groundingSources: mergedSources,
    groundingSummary,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildGroundingSummary(frameworkVersionings: FrameworkVersionGrounding[]): string {
  if (frameworkVersionings.length === 0) return 'No frameworks detected — no grounding required';

  const versionLabels = frameworkVersionings
    .filter((f) => f.versionInference.confidence >= 0.40)
    .map((f) => f.versionInference.label)
    .join(', ');

  const sourceCount = new Set(
    frameworkVersionings.flatMap((f) => f.groundingSources.map((s) => s.url)),
  ).size;

  const suffix = sourceCount > 0
    ? `— ${sourceCount} grounding source${sourceCount !== 1 ? 's' : ''} ready`
    : '— no grounding sources available';

  return versionLabels
    ? `${versionLabels} ${suffix}`
    : `${frameworkVersionings.map((f) => f.framework).join(', ')} (versions undetermined) ${suffix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyOutput(): VersionGroundingOutput {
  return {
    frameworks: [],
    detectedApiPatterns: [],
    requiresVersionClarification: false,
    versionClarificationQuestions: [],
    groundingSources: [],
    groundingSummary: 'No frameworks detected — no grounding required',
  };
}

function dedupApiPatterns(
  patterns: Array<{ api: string; framework: string; introducedInVersion: string; description: string; deprecatedInVersion: string | null }>,
) {
  const seen = new Set<string>();
  return patterns.filter((p) => {
    const key = `${p.framework}::${p.api}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

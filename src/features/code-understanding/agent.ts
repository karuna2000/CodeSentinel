/**
 * Code Understanding Agent — top-level pipeline orchestrator.
 *
 * This is the single entry point for the entire code understanding pipeline.
 * It drives all sub-stages in order and assembles the final structured output.
 *
 * Pipeline order:
 *  1. Language Detection
 *  2. Framework Detection
 *  3. Runtime Detection
 *  4. Artifact Classification
 *  5. Architectural Signal Extraction
 *  6. Dependency Extraction
 *  7. Confidence Evaluation
 *  8. Clarification Question Generation
 *  9. Summary synthesis
 *  10. Version Grounding (framework version + knowledge sources)
 *
 * Design:
 *  - Pure function — takes an InputArtifact, returns CodeUnderstandingOutput
 *  - No side effects, no LLM calls (deterministic-first parsing)
 *  - Extensible: each stage is independently testable and replaceable
 *  - Resilient: individual stage failures do not crash the agent
 *    (each stage is wrapped in a try/catch that falls back gracefully)
 */

import type { InputArtifact } from '@/types/artifact';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';

import { detectLanguage } from './pipeline/language-detector';
import { detectFramework } from './pipeline/framework-detector';
import { detectRuntime } from './pipeline/runtime-detector';
import { classifyArtifact } from './pipeline/artifact-classifier';
import { extractSignals } from './pipeline/signal-extractor';
import { extractDependencies } from './pipeline/dependency-extractor';
import { evaluateConfidence, formatConfidence } from './pipeline/confidence-evaluator';
import { generateClarificationQuestions } from './pipeline/clarification-generator';
import { runVersionGrounding } from '@/features/version-grounding';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full Code Understanding Agent pipeline over a normalised InputArtifact.
 *
 * This function NEVER throws. If a sub-stage encounters an error, it falls back
 * to a safe default so partial understanding is always returned.
 *
 * @param artifact The normalised input artifact (upload or paste)
 * @returns        Complete CodeUnderstandingOutput ready for downstream agents
 */
export function runCodeUnderstandingAgent(artifact: InputArtifact): CodeUnderstandingOutput {
  const { content, filename, language: hintLanguage } = artifact;

  // ─── Stage 1: Language Detection ────────────────────────────────────────
  const language = safeRun(
    () => detectLanguage(content, filename),
    { name: hintLanguage || 'Unknown', confidence: 0.30, detectedVia: 'fallback' as const },
  );

  // ─── Stage 2: Framework Detection ───────────────────────────────────────
  const framework = safeRun(
    () => detectFramework(content, filename),
    null,
  );

  // ─── Stage 3: Runtime Detection ─────────────────────────────────────────
  const runtime = safeRun(
    () => detectRuntime(content, filename),
    null,
  );

  // ─── Stage 4: Artifact Classification ───────────────────────────────────
  const artifactType = safeRun(
    () => classifyArtifact(content, filename),
    null,
  );

  // ─── Stage 5: Architectural Signal Extraction ────────────────────────────
  const architecturalSignals = safeRun(
    () => extractSignals(content),
    [],
  );

  // ─── Stage 6: Dependency Extraction ─────────────────────────────────────
  const dependencies = safeRun(
    () => extractDependencies(content, language.name),
    [],
  );

  // ─── Stage 7: Confidence Evaluation ─────────────────────────────────────
  const { overallConfidence, requiresClarification } = evaluateConfidence(
    language,
    framework,
    runtime,
    artifactType,
  );

  // ─── Stage 8: Clarification Question Generation ──────────────────────────
  const clarificationQuestions = safeRun(
    () =>
      generateClarificationQuestions({
        language,
        framework,
        runtime,
        artifactType,
        signals: architecturalSignals,
        overallConfidence,
        requiresClarification,
      }),
    [],
  );

  // ─── Stage 9: Summary synthesis ─────────────────────────────────────────
  const summary = buildSummary({
    language,
    framework,
    runtime,
    artifactType,
    overallConfidence,
    requiresClarification,
  });

  // ─── Stage 10: Version Grounding ─────────────────────────────────────────
  // Build a list of framework names to run version detection over:
  // the primary detected framework + any known library frameworks found in deps.
  const frameworksToGround: string[] = [];
  if (framework) frameworksToGround.push(framework.name);
  // Include well-known library frameworks from the dependency list
  const LIBRARY_FRAMEWORKS = ['Prisma', 'Mongoose', 'tRPC', 'Zod'];
  for (const dep of dependencies) {
    if (dep === '@prisma/client') frameworksToGround.push('Prisma');
    if (dep === 'mongoose') frameworksToGround.push('Mongoose');
    if (dep.startsWith('@trpc/')) frameworksToGround.push('tRPC');
  }
  // Deduplicate
  const uniqueFrameworks = [...new Set(frameworksToGround)].filter(
    (f) => !LIBRARY_FRAMEWORKS.every((lf) => lf !== f) || frameworksToGround.includes(f),
  );

  const versionGrounding = safeRun(
    () => runVersionGrounding(uniqueFrameworks, content),
    null,
  );

  return {
    language,
    framework,
    runtime,
    artifactType,
    dependencies,
    architecturalSignals,
    overallConfidence,
    requiresClarification,
    clarificationQuestions,
    summary,
    versionGrounding,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

interface SummaryInput {
  language: { name: string; confidence: number };
  framework: { name: string } | null;
  runtime: { type: string } | null;
  artifactType: { type: string } | null;
  overallConfidence: number;
  requiresClarification: boolean;
}

function buildSummary({
  language,
  framework,
  runtime,
  artifactType,
  overallConfidence,
  requiresClarification,
}: SummaryInput): string {
  const parts: string[] = [];

  // Artifact role
  if (artifactType) {
    parts.push(humanizeArtifactType(artifactType.type));
  } else {
    parts.push('Code file');
  }

  // Language
  parts.push(`in ${language.name}`);

  // Framework
  if (framework) {
    parts.push(`using ${framework.name}`);
  }

  // Runtime
  if (runtime) {
    parts.push(`(${humanizeRuntime(runtime.type)} runtime)`);
  }

  // Confidence suffix
  const confidenceStr = formatConfidence(overallConfidence);
  const clarificationNote = requiresClarification ? ' — clarification needed' : '';
  parts.push(`· ${confidenceStr} confidence${clarificationNote}`);

  return parts.join(' ');
}

function humanizeArtifactType(type: string): string {
  const map: Record<string, string> = {
    'react-component': 'React component',
    'api-route': 'API route handler',
    'middleware': 'Middleware function',
    'hook': 'React hook',
    'context-provider': 'React context provider',
    'schema-model': 'Schema/model definition',
    'utility': 'Utility module',
    'config': 'Configuration file',
    'auth-module': 'Authentication module',
    'database-layer': 'Database access layer',
    'test-file': 'Test file',
    'store': 'State store',
    'service': 'Service class',
  };
  return map[type] ?? type;
}

function humanizeRuntime(type: string): string {
  const map: Record<string, string> = {
    browser: 'Browser',
    node: 'Node.js',
    edge: 'Edge',
    serverless: 'Serverless',
    cli: 'CLI',
    middleware: 'Middleware',
  };
  return map[type] ?? type;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely runs a pipeline stage, returning a fallback value on error.
 * This ensures partial failures do not crash the whole agent.
 */
function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

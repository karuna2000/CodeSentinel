/**
 * Code Understanding Agent — public barrel export.
 *
 * This is the single public API surface for the feature module.
 * All external consumers (audit-engine, hooks, tests) import from here.
 */

export { runCodeUnderstandingAgent } from './agent';

// Pipeline sub-modules re-exported for testing and advanced usage
export { detectLanguage } from './pipeline/language-detector';
export { detectFramework } from './pipeline/framework-detector';
export { detectRuntime } from './pipeline/runtime-detector';
export { classifyArtifact } from './pipeline/artifact-classifier';
export { extractSignals } from './pipeline/signal-extractor';
export { extractDependencies, getExternalDependencies } from './pipeline/dependency-extractor';
export { evaluateConfidence, formatConfidence, CLARIFICATION_THRESHOLD } from './pipeline/confidence-evaluator';
export { generateClarificationQuestions, MAX_QUESTIONS } from './pipeline/clarification-generator';


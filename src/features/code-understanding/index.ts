

export { runCodeUnderstandingAgent } from './agent';

export { detectLanguage } from './pipeline/language-detector';
export { detectFramework } from './pipeline/framework-detector';
export { detectRuntime } from './pipeline/runtime-detector';
export { classifyArtifact } from './pipeline/artifact-classifier';
export { extractSignals } from './pipeline/signal-extractor';
export { extractDependencies, getExternalDependencies } from './pipeline/dependency-extractor';
export { evaluateConfidence, formatConfidence, CLARIFICATION_THRESHOLD } from './pipeline/confidence-evaluator';
export { generateClarificationQuestions, MAX_QUESTIONS } from './pipeline/clarification-generator';


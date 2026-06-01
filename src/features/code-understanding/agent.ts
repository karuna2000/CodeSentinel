

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

export function runCodeUnderstandingAgent(artifact: InputArtifact): CodeUnderstandingOutput {
  const { content, filename, language: hintLanguage } = artifact;

  
  const language = safeRun(
    () => detectLanguage(content, filename),
    { name: hintLanguage || 'Unknown', confidence: 0.30, detectedVia: 'fallback' as const },
  );

  
  const framework = safeRun(
    () => detectFramework(content, filename),
    null,
  );

  
  const runtime = safeRun(
    () => detectRuntime(content, filename),
    null,
  );

  
  const artifactType = safeRun(
    () => classifyArtifact(content, filename),
    null,
  );

  
  const architecturalSignals = safeRun(
    () => extractSignals(content),
    [],
  );

  
  const dependencies = safeRun(
    () => extractDependencies(content, language.name),
    [],
  );

  
  const { overallConfidence, requiresClarification } = evaluateConfidence(
    language,
    framework,
    runtime,
    artifactType,
  );

  
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

  
  const summary = buildSummary({
    language,
    framework,
    runtime,
    artifactType,
    overallConfidence,
    requiresClarification,
  });

  
  
  
  const frameworksToGround: string[] = [];
  if (framework) frameworksToGround.push(framework.name);
  
  const LIBRARY_FRAMEWORKS = ['Prisma', 'Mongoose', 'tRPC', 'Zod'];
  for (const dep of dependencies) {
    if (dep === '@prisma/client') frameworksToGround.push('Prisma');
    if (dep === 'mongoose') frameworksToGround.push('Mongoose');
    if (dep.startsWith('@trpc/')) frameworksToGround.push('tRPC');
  }
  
  const uniqueFrameworks = [...new Set(frameworksToGround)];

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

  
  if (artifactType) {
    parts.push(humanizeArtifactType(artifactType.type));
  } else {
    parts.push('Code file');
  }

  
  parts.push(`in ${language.name}`);

  
  if (framework) {
    parts.push(`using ${framework.name}`);
  }

  
  if (runtime) {
    parts.push(`(${humanizeRuntime(runtime.type)} runtime)`);
  }

  
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

function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Clarification Generator — generates targeted, concise questions for the user
 * when the agent lacks sufficient context to understand the code with confidence.
 *
 * Principles:
 *  - Questions must reduce hallucination, not just check boxes
 *  - Maximum 3 questions to avoid overwhelming the user
 *  - Each question has a reason explaining WHY it's being asked
 *  - Questions are ordered by impact (most important first)
 *  - Only generate questions when truly needed — avoid excessive questioning
 *
 * Design:
 *  - Pure function, no side effects
 *  - Takes the full detection context to generate informed questions
 *  - Does NOT generate questions when overall confidence is high
 */

import type {
  ClarificationQuestion,
  LanguageDetection,
  FrameworkDetection,
  RuntimeDetection,
  ArtifactTypeDetection,
  ArchitecturalSignal,
} from '@/types/code-understanding';

export const MAX_QUESTIONS = 3;

// ---------------------------------------------------------------------------
// Question generation rules
// ---------------------------------------------------------------------------

interface QuestionRule {
  /** Priority — lower number = asked first */
  priority: number;
  question: string;
  reason: string;
  /** Returns true if this question should be generated */
  shouldAsk: (ctx: QuestionContext) => boolean;
}

interface QuestionContext {
  language: LanguageDetection;
  framework: FrameworkDetection | null;
  runtime: RuntimeDetection | null;
  artifactType: ArtifactTypeDetection | null;
  signals: ArchitecturalSignal[];
  overallConfidence: number;
  requiresClarification: boolean;
}

const QUESTION_RULES: QuestionRule[] = [
  // Low language confidence
  {
    priority: 1,
    question: 'What programming language is this code written in?',
    reason: 'The language could not be determined with certainty from the file content.',
    shouldAsk: (ctx) => ctx.language.confidence < 0.55,
  },

  // No framework detected but code looks like it could be many things
  {
    priority: 2,
    question: 'Is this file part of a specific framework project (e.g. Next.js, Express, Django)?',
    reason: 'No clear framework signals were found. This helps tailor the analysis to your stack.',
    shouldAsk: (ctx) =>
      ctx.framework === null &&
      ctx.language.confidence > 0.50 &&
      ['TypeScript', 'JavaScript', 'Python'].some((l) => ctx.language.name.includes(l)),
  },

  // Ambiguous runtime — browser vs Node
  {
    priority: 3,
    question: 'Is this code intended to run in the browser, on the server (Node.js), or at the edge?',
    reason: 'The runtime environment is ambiguous, which affects how authentication, storage, and APIs should be analysed.',
    shouldAsk: (ctx) =>
      ctx.runtime === null ||
      (ctx.runtime.confidence < 0.65 && ctx.runtime.type !== 'edge'),
  },

  // Auth signal present but no framework
  {
    priority: 4,
    question: 'Is authentication handled in this file, or is it delegated to middleware/another service?',
    reason: 'Authentication patterns were detected, but the scope is unclear. This is important for security analysis.',
    shouldAsk: (ctx) =>
      ctx.signals.some((s) => s.name === 'authentication') && ctx.framework === null,
  },

  // Database signal with no ORM context
  {
    priority: 5,
    question: 'What database or ORM is used in this project (e.g. Prisma, Mongoose, raw SQL)?',
    reason: 'Database access patterns were found but the ORM/driver could not be confirmed. This matters for scalability and security review.',
    shouldAsk: (ctx) =>
      ctx.signals.some((s) => s.name === 'database') &&
      ctx.framework?.name !== 'Prisma' &&
      ctx.framework?.name !== 'Mongoose',
  },

  // No artifact type classification
  {
    priority: 6,
    question: "What is the intended role of this file (e.g. API route, component, utility, database model)?",
    reason: "The file's architectural role could not be determined with confidence, which affects how it is reviewed.",
    shouldAsk: (ctx) => ctx.artifactType === null && ctx.overallConfidence < 0.70,
  },

  // Low overall confidence — generic fallback
  {
    priority: 7,
    question: 'Is this file part of a larger project, and if so, what is its main purpose?',
    reason: 'Overall confidence is low without broader project context. Additional context significantly improves analysis quality.',
    shouldAsk: (ctx) => ctx.overallConfidence < 0.50,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates targeted clarification questions based on detection gaps.
 *
 * @returns Up to MAX_QUESTIONS questions ordered by priority (most important first).
 *          Returns an empty array when requiresClarification is false.
 */
export function generateClarificationQuestions(
  ctx: QuestionContext,
): ClarificationQuestion[] {
  if (!ctx.requiresClarification) return [];

  const triggered = QUESTION_RULES.filter((rule) => rule.shouldAsk(ctx))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_QUESTIONS);

  return triggered.map(({ question, reason }) => ({ question, reason }));
}

// Re-export context type for agent.ts
export type { QuestionContext };

/**
 * Version Clarification Generator — generates version-specific clarification
 * questions when version inference is uncertain.
 *
 * These questions are separate from the general clarification questions
 * in the Code Understanding Agent. They are targeted specifically at
 * reducing version-related hallucination risk.
 *
 * Principles:
 *  - Only ask when version confidence is below VERSION_CLARIFICATION_THRESHOLD
 *  - Questions are framework-specific and actionable
 *  - Max 1 question per framework
 *  - Total max 2 version questions (avoid overwhelming the user)
 *
 * Design:
 *  - Pure function, no side effects
 */

import { getFrameworkEntry } from './framework-registry';

/** Below this threshold, ask the user for version clarification */
export const VERSION_CLARIFICATION_THRESHOLD = 0.60;

/** Maximum total version clarification questions across all frameworks */
const MAX_VERSION_QUESTIONS = 2;

// ---------------------------------------------------------------------------
// Framework-specific question templates
// ---------------------------------------------------------------------------

const VERSION_QUESTIONS: Record<string, (versionHint: string | null) => string> = {
  'React': (hint) =>
    hint
      ? `Is this React ${hint} code, or a different version?`
      : 'Which version of React is this project using (e.g. React 18, React 19)?',

  'Next.js': (hint) =>
    hint?.includes('App Router')
      ? 'Is this Next.js App Router (13+) code, or Pages Router?'
      : 'Which Next.js version and routing model is this project using (e.g. Next.js 14 App Router)?',

  'Vue': (hint) =>
    hint?.includes('3')
      ? 'Is this Vue 3 Composition API or Vue 2 Options API?'
      : 'Which version of Vue is this project using (Vue 2 or Vue 3)?',

  'Express': (_hint) =>
    'Which version of Express is this project using (Express 4 or Express 5)?',

  'Angular': (_hint) =>
    'Which version of Angular is this project using (e.g. Angular 16, 17)?',

  'NestJS': (_hint) =>
    'Which version of NestJS is this project using (e.g. NestJS 9, 10)?',

  'Prisma': (hint) =>
    hint
      ? `Is this Prisma ${hint} code?`
      : 'Which version of Prisma is this project using (e.g. Prisma 4, 5)?',

  'FastAPI': (_hint) =>
    'Which version of FastAPI is this project using (e.g. FastAPI 0.100+)?',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates version clarification questions for frameworks whose inferred
 * version confidence is below the threshold.
 *
 * @param frameworkVersions  Map of framework name → { confidence, versionLabel }
 * @returns  Array of clarification question strings (max MAX_VERSION_QUESTIONS)
 */
export function generateVersionClarificationQuestions(
  frameworkVersions: Array<{
    framework: string;
    confidence: number;
    versionLabel: string | null;
  }>,
): string[] {
  const questions: string[] = [];

  for (const { framework, confidence, versionLabel } of frameworkVersions) {
    if (questions.length >= MAX_VERSION_QUESTIONS) break;

    if (confidence < VERSION_CLARIFICATION_THRESHOLD) {
      // Use framework-specific template if available
      const templateFn = VERSION_QUESTIONS[framework];
      if (templateFn) {
        questions.push(templateFn(versionLabel));
      } else {
        // Generic fallback for frameworks not in the template map
        const entry = getFrameworkEntry(framework);
        if (entry && entry.versionBrackets.length > 0) {
          const versionList = entry.versionBrackets.map((b) => b.label).join(' / ');
          questions.push(`Which version of ${framework} is this project using? (${versionList})`);
        }
      }
    }
  }

  return questions;
}

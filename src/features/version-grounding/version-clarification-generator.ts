

import { getFrameworkEntry } from './framework-registry';

export const VERSION_CLARIFICATION_THRESHOLD = 0.60;

const MAX_VERSION_QUESTIONS = 2;

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
      
      const templateFn = VERSION_QUESTIONS[framework];
      if (templateFn) {
        questions.push(templateFn(versionLabel));
      } else {
        
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

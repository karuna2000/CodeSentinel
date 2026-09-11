import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { getDefaultChatModel } from '@/lib/llm/provider';

/**
 * Wiki Eval — Completeness Testing
 *
 * Verifies that wiki page generation produces complete, well-structured
 * documentation covering all required sections.
 *
 * Run: npm run eval -- --grep "Wiki"
 */

interface WikiEvalCase {
  folderPath: string;
  symbols: string[];
  imports: string[];
  /** Sections that must appear in the generated wiki page */
  requiredSections: string[];
  /** Minimum word count for the generated page */
  minWords: number;
}

const wikiTestCases: WikiEvalCase[] = [
  {
    folderPath: 'src/features/llm-reasoning',
    symbols: ['FUNCTION: runReasoningEngine', 'FUNCTION: runChatEngine', 'TYPE: ReasoningOptions'],
    imports: ['src/features/context-engine', 'src/lib/llm/provider'],
    requiredSections: ['Purpose', 'Key Exports', 'Dependencies', 'Developer Notes'],
    minWords: 120,
  },
  {
    folderPath: 'src/lib',
    symbols: ['FUNCTION: checkRateLimit', 'FUNCTION: logger', 'CONSTANT: env'],
    imports: ['src/config/app.config'],
    requiredSections: ['Purpose', 'Key Exports', 'Dependencies'],
    minWords: 100,
  },
  {
    folderPath: 'src/features/wiki/services',
    symbols: ['FUNCTION: generateWikiPages', 'FUNCTION: generateFlowchart'],
    imports: ['src/lib/db', 'src/lib/llm/provider'],
    requiredSections: ['Purpose', 'Key Exports', 'Dependencies', 'Developer Notes'],
    minWords: 120,
  },
];

describe('Wiki Eval — Completeness', () => {
  for (const tc of wikiTestCases) {
    it(`should generate complete wiki page for "${tc.folderPath}"`, async () => {
      const prompt = `You are generating a wiki page for a software engineering codebase.

Folder: ${tc.folderPath}

Symbols defined here:
${tc.symbols.join('\n')}

Imports/depends on:
${tc.imports.join('\n')}

Write a concise Markdown wiki page (150–300 words) covering:
1. **Purpose** — What does this module/folder do?
2. **Key Exports** — List the most important functions, classes, or types.
3. **Dependencies** — What does it depend on?
4. **Developer Notes** — Any gotchas, patterns, or important conventions.

Use ## headings for each section. Do not add a top-level title.`;

      const { text } = await generateText({
        model: getDefaultChatModel(),
        system: 'You are a senior software engineer writing technical wiki documentation. Be precise and concise.',
        prompt,
        temperature: 0.3,
        maxOutputTokens: 1024,
      });

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(tc.minWords);

      for (const section of tc.requiredSections) {
        expect(text.toLowerCase()).toContain(section.toLowerCase());
      }

      // Should not contain placeholder text
      expect(text.toLowerCase()).not.toContain('todo');
      expect(text.toLowerCase()).not.toContain('lorem ipsum');
    });
  }

  it('should reference actual symbols in the generated page', async () => {
    const symbols = ['FUNCTION: checkRateLimit', 'TYPE: RateLimitResult'];
    const { text } = await generateText({
      model: getDefaultChatModel(),
      system: 'You are a senior software engineer writing technical wiki documentation.',
      prompt: `Write a wiki page for src/lib with these symbols: ${symbols.join(', ')}. Include ## headings.`,
      temperature: 0.3,
      maxOutputTokens: 512,
    });

    // At least one symbol name should appear in the output
    const hasSymbolRef =
      text.includes('checkRateLimit') || text.includes('RateLimitResult');
    expect(hasSymbolRef).toBe(true);
  });

  it('should produce valid markdown with headings', async () => {
    const { text } = await generateText({
      model: getDefaultChatModel(),
      system: 'You are a senior software engineer writing technical wiki documentation.',
      prompt: `Write a wiki page for src/lib with symbols: FUNCTION: logger. Include ## headings for each section.`,
      temperature: 0.3,
      maxOutputTokens: 512,
    });

    // Must have at least 2 markdown headings
    const headings = text.match(/^##\s+.+/gm) ?? [];
    expect(headings.length).toBeGreaterThanOrEqual(2);
  });
});

import { describe, it, expect } from 'vitest';
import { generateText } from 'ai';
import { getDefaultChatModel } from '@/lib/llm/provider';

/**
 * Chat Eval — Grounding Testing
 *
 * Verifies that the chat engine produces answers grounded in the
 * provided context, not hallucinated information.
 *
 * Run: npm run eval -- --grep "Chat"
 */

interface ChatEvalCase {
  systemContext: string;
  question: string;
  /** Strings that MUST appear in the response (grounded in context) */
  mustContain: string[];
  /** Strings that should NOT appear (hallucination markers) */
  mustNotContain: string[];
}

const groundedCases: ChatEvalCase[] = [
  {
    systemContext: `=== RELEVANT CODE NODES ===
--- Node: src/lib/rate-limit.ts (FILE) ---
export function checkRateLimit(key: string): RateLimitResult { ... }
The rate limit uses an in-memory Map with a 60-second window and max 10 requests.

--- Node: src/middleware.ts (FILE) ---
Middleware applies rate limiting to auth routes using IP-based keys.`,
    question: 'How does the rate limiter work?',
    mustContain: ['rate limit', '60'],
    mustNotContain: ['Redis', 'database', 'postgreSQL'],
  },
  {
    systemContext: `=== RELEVANT CODE NODES ===
--- Node: src/lib/llm/provider.ts (FILE) ---
Uses NVIDIA NIM API with model minimaxai/minimax-m3.
Base URL: https://integrate.api.nvidia.com/v1`,
    question: 'What LLM provider does this project use?',
    mustContain: ['NVIDIA', 'minimax'],
    mustNotContain: ['OpenAI', 'Anthropic', 'Claude'],
  },
  {
    systemContext: `=== RELEVANT CODE NODES ===
--- Node: src/features/wiki/services/module-summarizer.ts (FILE) ---
Groups graph nodes by top-level folder and generates LLM-written Markdown summaries.
Uses streamText with temperature 0.3.
Sleeps 1500ms between calls to avoid rate limits.`,
    question: 'How does wiki generation handle rate limiting?',
    mustContain: ['sleep', '1500'],
    mustNotContain: ['retry', 'exponential'],
  },
];

const ungroundedCase: ChatEvalCase = {
  systemContext: '=== RELEVANT CODE NODES ===\n(No relevant code found for this query)',
  question: 'What is the deployment strategy for this project?',
  mustContain: [],
  // When context is empty, the model should NOT make up specific deployment details
  mustNotContain: ['Kubernetes', 'Docker Compose', 'AWS ECS', 'Vercel deploy'],
};

describe('Chat Eval — Grounding', () => {
  for (const tc of groundedCases) {
    it(`should ground answer for "${tc.question.slice(0, 40)}..."`, async () => {
      const { text } = await generateText({
        model: getDefaultChatModel(),
        system: `You are a code assistant. Use ONLY the following context to answer.
If the answer is not in the context, say "I don't have enough context to answer that."\n\n${tc.systemContext}`,
        prompt: tc.question,
        temperature: 0,
        maxOutputTokens: 512,
      });

      const lower = text.toLowerCase();

      for (const term of tc.mustContain) {
        expect(lower).toContain(term.toLowerCase());
      }

      for (const term of tc.mustNotContain) {
        expect(lower).not.toContain(term.toLowerCase());
      }
    });
  }

  it('should admit ignorance when context is empty', async () => {
    const { text } = await generateText({
      model: getDefaultChatModel(),
      system: `You are a code assistant. Use ONLY the following context to answer.
If the answer is not in the context, say "I don't have enough context to answer that."\n\n${ungroundedCase.systemContext}`,
      prompt: ungroundedCase.question,
      temperature: 0,
      maxOutputTokens: 256,
    });

    const lower = text.toLowerCase();
    const admitsIgnorance =
      lower.includes("don't have enough context") ||
      lower.includes('not enough context') ||
      lower.includes('cannot determine') ||
      lower.includes('no context');

    expect(admitsIgnorance).toBe(true);

    for (const term of ungroundedCase.mustNotContain) {
      expect(lower).not.toContain(term.toLowerCase());
    }
  });

  it('should produce non-empty response', async () => {
    const { text } = await generateText({
      model: getDefaultChatModel(),
      system: 'You are a helpful code assistant.',
      prompt: 'What is a variable?',
      temperature: 0,
      maxOutputTokens: 128,
    });
    expect(text.length).toBeGreaterThan(10);
  });
});

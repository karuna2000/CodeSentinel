import { describe, it, expect } from 'vitest';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString } from '@/features/context-engine/services/budget-manager';

/**
 * Retrieval Eval — Recall Testing
 *
 * Measures whether the hybrid retriever (BM25 + semantic + graph)
 * surfaces the correct nodes for a given query.
 *
 * Run: npm run eval -- --grep "Retrieval"
 */

const EVAL_REPO_ID = process.env.EVAL_REPO_ID ?? 'test-repo-id';

interface RetrievalTestCase {
  query: string;
  searchTerms: string[];
  /** Substrings expected somewhere in the retrieved node names */
  expectedNodePatterns: string[];
  /** Maximum acceptable retrieval count (sanity) */
  maxNodes?: number;
}

const testCases: RetrievalTestCase[] = [
  {
    query: 'authentication middleware',
    searchTerms: ['auth', 'middleware', 'session'],
    expectedNodePatterns: ['middleware', 'auth'],
    maxNodes: 20,
  },
  {
    query: 'database connection and Prisma client',
    searchTerms: ['database', 'prisma', 'client'],
    expectedNodePatterns: ['prisma', 'db'],
    maxNodes: 20,
  },
  {
    query: 'rate limiting implementation',
    searchTerms: ['rate', 'limit', 'throttle'],
    expectedNodePatterns: ['rate-limit', 'checkRateLimit'],
    maxNodes: 15,
  },
  {
    query: 'LLM streaming response',
    searchTerms: ['stream', 'llm', 'model'],
    expectedNodePatterns: ['stream', 'model'],
    maxNodes: 20,
  },
];

describe('Retrieval Eval — Recall', () => {
  for (const tc of testCases) {
    it(`should retrieve relevant nodes for "${tc.query}"`, async () => {
      const context = await retrieveContext(EVAL_REPO_ID, tc.searchTerms, tc.query);

      expect(context.nodes.length).toBeGreaterThan(0);

      if (tc.maxNodes) {
        expect(context.nodes.length).toBeLessThanOrEqual(tc.maxNodes);
      }

      const nodeNames = context.nodes.map((n) => n.name.toLowerCase());
      const matchedCount = tc.expectedNodePatterns.filter((pattern) =>
        nodeNames.some((name) => name.includes(pattern.toLowerCase()))
      ).length;

      // At least 50% of expected patterns should appear in retrieved results
      const recallThreshold = Math.ceil(tc.expectedNodePatterns.length * 0.5);
      expect(matchedCount).toBeGreaterThanOrEqual(recallThreshold);
    });
  }

  it('should format retrieved context into a non-empty string', async () => {
    const context = await retrieveContext(EVAL_REPO_ID, ['auth'], 'auth flow');
    const formatted = formatContextString(context);
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('RELEVANT CODE NODES');
  });

  it('should handle empty search terms gracefully', async () => {
    const context = await retrieveContext(EVAL_REPO_ID, [], 'general overview');
    expect(Array.isArray(context.nodes)).toBe(true);
  });

  it('should cap context within token budget', async () => {
    const context = await retrieveContext(EVAL_REPO_ID, ['a', 'b', 'c'], 'multi query test');
    const formatted = formatContextString(context);
    // Budget manager caps at ~12k tokens (~48k chars)
    expect(formatted.length).toBeLessThan(60_000);
  });
});

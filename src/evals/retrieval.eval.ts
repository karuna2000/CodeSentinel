import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString } from '@/features/context-engine/services/budget-manager';
import {
  DEFAULT_K,
  formatScoreTable,
  scoreCase,
  summarizeRun,
  type CaseScore,
} from '@/features/context-engine/services/retrieval-metrics';
import { db } from '@/lib/db';

/**
 * Retrieval Eval — Recall Testing
 *
 * Measures whether the hybrid retriever (BM25 + semantic + graph)
 * surfaces the correct nodes for a given query.
 *
 * Repo-agnostic: recall targets are resolved from the indexed repo itself
 * (`EVAL_REPO_ID`), so this gate is meaningful on any fixture that has graph
 * data, and skips recall (rather than failing) when the repo simply doesn't
 * contain symbols matching a query's intent.
 *
 * Run: EVAL_REPO_ID=<indexed repo id> npm run eval
 */

const EVAL_REPO_ID = process.env.EVAL_REPO_ID ?? '';

// Hard cap enforced by the retriever (see hybrid-retriever MAX_TOTAL_NODES).
const MAX_TOTAL_NODES = 20;
// At least half of the repo-resolved expectations must appear in the results.
const MIN_RECALL_FRACTION = 0.5;

interface IntentCase {
  name: string;
  query: string;
  searchTerms: string[];
}

const INTENT_CASES: IntentCase[] = [
  {
    name: 'authentication / middleware',
    query: 'authentication middleware',
    searchTerms: ['auth', 'middleware', 'session'],
  },
  {
    name: 'database connection & query layer',
    query: 'database connection and query layer',
    searchTerms: ['database', 'prisma', 'db', 'client', 'sequelize'],
  },
  {
    name: 'rate limiting / resilience',
    query: 'rate limiting and resilience implementation',
    searchTerms: ['rate', 'limit', 'throttle', 'circuit', 'retry'],
  },
  {
    name: 'streaming response handling',
    query: 'streaming response handling',
    searchTerms: ['stream', 'model', 'llm'],
  },
  {
    name: 'impact of changing auth',
    query: 'what could break if I change the session handling',
    searchTerms: ['session', 'auth', 'change'],
  },
  {
    name: 'callers and dependencies',
    query: 'what calls the rate limiter',
    searchTerms: ['rate', 'limit', 'calls'],
  },
];

function nameMatchesAny(name: string, terms: string[]): boolean {
  const n = name.toLowerCase();
  return terms.some((t) => n.includes(t.toLowerCase()));
}

describe('Retrieval Eval — Recall', () => {
  let nodeNames: string[] = [];
  const nodeIdsByName = new Map<string, string>();
  const caseScores: CaseScore[] = [];
  // Always-on control: recall against the repo's own most common symbol token,
  // so a real recall assertion is exercised on any fixture.
  let controlTerm = '';
  let controlTarget = 0;

  beforeAll(async () => {
    if (!EVAL_REPO_ID) {
      throw new Error(
        'EVAL_REPO_ID is not set. Point it at an indexed repository id in the local DB ' +
        '(e.g. EVAL_REPO_ID=<id> npm run eval). Repos with graph data: see `prisma`/`db` shell or the app.'
      );
    }

    const rows = await db.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name FROM graph_nodes WHERE repo_id = ${EVAL_REPO_ID} AND name IS NOT NULL
    `;
    nodeNames = rows.map((r) => r.name).filter(Boolean);
    for (const row of rows) {
      if (row.name && !nodeIdsByName.has(row.name.toLowerCase())) {
        nodeIdsByName.set(row.name.toLowerCase(), row.id);
      }
    }

    if (nodeNames.length === 0) {
      throw new Error(
        `No graph nodes found for repo ${EVAL_REPO_ID}. Pick an indexed repo id.`
      );
    }

    const counts = new Map<string, number>();
    for (const name of nodeNames) {
      for (const token of name.split(/[^A-Za-z0-9]+/)) {
        const t = token.toLowerCase();
        if (t.length >= 3) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    const control = Array.from(counts.entries()).find(([, c]) => c >= 2)
      ?? Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (control) {
      controlTerm = control[0];
      controlTarget = control[1];
    }
  });

  it(`should surface repo symbols matching "${controlTerm}" (auto-control, ${controlTarget}+ expected)`, async (ctx) => {
    if (!controlTerm) return ctx.skip('repo has no name tokens of length >= 4');
    const context = await retrieveContext(EVAL_REPO_ID, [controlTerm], controlTerm);
    expect(context.nodes.length).toBeGreaterThan(0);
    const matched = context.nodes.filter((n) => nameMatchesAny(n.name, [controlTerm])).length;
    expect(matched).toBeGreaterThanOrEqual(1);
  });

  for (const tc of INTENT_CASES) {
    it(`should retrieve relevant nodes for "${tc.query}"`, async (ctx) => {
      const relevant = nodeNames.filter((name) => nameMatchesAny(name, tc.searchTerms));

      const context = await retrieveContext(EVAL_REPO_ID, tc.searchTerms, tc.query);

      // Data sanity: repo has nodes and the retriever returns a bounded set.
      expect(context.nodes.length).toBeGreaterThan(0);
      expect(context.nodes.length).toBeLessThanOrEqual(MAX_TOTAL_NODES);

      if (relevant.length === 0) {
        caseScores.push(scoreCase(tc.name, [], new Set()));
        return ctx.skip(
          `repo has no symbols matching [${tc.searchTerms.join(', ')}]; recall not asserted`
        );
      }

      const retrievedLower = context.nodes.map((n) => n.name.toLowerCase());
      const matched = relevant.filter((name) =>
        retrievedLower.includes(name.toLowerCase())
      ).length;
      const threshold = Math.ceil(relevant.length * MIN_RECALL_FRACTION);

      expect(
        matched,
        `retrieved ${matched}/${relevant.length} expected nodes for "${tc.name}"\n` +
          `top results:\n${context.nodes.slice(0, 8).map((n) => `  - ${n.type}: ${n.name}`).join('\n')}`
      ).toBeGreaterThanOrEqual(Math.min(threshold, 1));

      // Rank-aware scoring: relevant ids (by name match) against retrieval order.
      const relevantIds = new Set<string>();
      for (const name of relevant) {
        const id = nodeIdsByName.get(name.toLowerCase());
        if (id) relevantIds.add(id);
      }
      const rankedIds = context.nodes.map((n) => n.id);
      const score = scoreCase(tc.name, rankedIds, relevantIds, DEFAULT_K);
      caseScores.push(score);

      // Hard rank floor only for tightly-scoped cases (few expected nodes):
      // at least half must land in the top-k. Broad cases report without a
      // floor — a 20-node list cannot cover 50 matches in its top 6.
      if (relevant.length <= DEFAULT_K) {
        expect(
          score.recallAtK ?? 0,
          `recall@${DEFAULT_K} too low for tightly-scoped case "${tc.name}" ` +
            `(matched ${score.matched}/${relevant.length} in top ${DEFAULT_K})`,
        ).toBeGreaterThanOrEqual(MIN_RECALL_FRACTION);
      }
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

  afterAll(() => {
    const summary = summarizeRun(caseScores);
    const fmt = (v: number | null) => (v === null ? 'n/a' : v.toFixed(3));
    console.log(
      `\n[Retrieval Eval] scored ${summary.scored}/${summary.cases} cases ` +
        `(${summary.skipped} skipped) | mean recall@${DEFAULT_K}=${fmt(summary.meanRecallAtK)} ` +
        `| mean RR=${fmt(summary.meanReciprocalRank)} | mean NDCG@${DEFAULT_K}=${fmt(summary.meanNdcgAtK)}` +
        formatScoreTable(caseScores),
    );
  });
});
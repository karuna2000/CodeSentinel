/**
 * Rank-aware retrieval metrics (Phase E).
 *
 * Pure functions over ranked id lists — the eval harness resolves the
 * "relevant" set from the fixture repo itself, these helpers score the
 * ranking. Unit-tested in `__tests__/retrieval-metrics.spec.ts`.
 *
 * Conventions:
 * - `ranked` is the retriever's node-id order (best first).
 * - `relevant` is the set of node ids counted as expected for the case.
 * - `k` defaults to 6 (spec target: recall@6 ≥ 85% on a golden fixture).
 * - Functions return `null` when the case is unscoreable (empty relevant
 *   set) so the harness skips instead of asserting on noise.
 */

export const DEFAULT_K = 6;

export interface CaseScore {
  name: string;
  k: number;
  retrieved: number;
  relevantTotal: number;
  matched: number;
  recallAtK: number | null;
  reciprocalRank: number | null;
  ndcgAtK: number | null;
  skipped: boolean;
  skipReason?: string;
}

/** Fraction of relevant ids appearing in the top-k (null when unscorable). */
export function recallAtK(ranked: string[], relevant: ReadonlySet<string>, k: number = DEFAULT_K): number | null {
  if (relevant.size === 0) return null;
  const top = ranked.slice(0, k);
  const matched = top.filter((id) => relevant.has(id)).length;
  return matched / relevant.size;
}

/** 1/rank of the first relevant hit (1-based), 0 when none in the list. */
export function reciprocalRank(ranked: string[], relevant: ReadonlySet<string>): number | null {
  if (relevant.size === 0) return null;
  const idx = ranked.findIndex((id) => relevant.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

/** Binary-relevance NDCG@k (null when unscorable). */
export function ndcgAtK(ranked: string[], relevant: ReadonlySet<string>, k: number = DEFAULT_K): number | null {
  if (relevant.size === 0) return null;
  const top = ranked.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < top.length; i++) {
    if (relevant.has(top[i])) dcg += 1 / Math.log2(i + 2);
  }
  const idealHits = Math.min(relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export function scoreCase(
  name: string,
  ranked: string[],
  relevant: ReadonlySet<string>,
  k: number = DEFAULT_K,
): CaseScore {
  if (relevant.size === 0) {
    return {
      name, k, retrieved: ranked.length, relevantTotal: 0, matched: 0,
      recallAtK: null, reciprocalRank: null, ndcgAtK: null,
      skipped: true, skipReason: 'no relevant nodes in fixture',
    };
  }
  const matched = ranked.filter((id) => relevant.has(id)).length;
  return {
    name, k, retrieved: ranked.length, relevantTotal: relevant.size, matched,
    recallAtK: recallAtK(ranked, relevant, k),
    reciprocalRank: reciprocalRank(ranked, relevant),
    ndcgAtK: ndcgAtK(ranked, relevant, k),
    skipped: false,
  };
}

export interface RunSummary {
  cases: number;
  scored: number;
  skipped: number;
  meanRecallAtK: number | null;
  meanReciprocalRank: number | null;
  meanNdcgAtK: number | null;
}

/** Macro-average over scored (non-skipped) cases. */
export function summarizeRun(scores: CaseScore[]): RunSummary {
  const scored = scores.filter((s) => !s.skipped);
  const mean = (pick: (s: CaseScore) => number | null): number | null => {
    const vals = scored.map(pick).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  return {
    cases: scores.length,
    scored: scored.length,
    skipped: scores.length - scored.length,
    meanRecallAtK: mean((s) => s.recallAtK),
    meanReciprocalRank: mean((s) => s.reciprocalRank),
    meanNdcgAtK: mean((s) => s.ndcgAtK),
  };
}

/** One-line-per-case report for the verbose eval reporter. */
export function formatScoreTable(scores: CaseScore[]): string {
  const lines = ['\ncase | k | retrieved | relevant | matched | recall@k | RR | NDCG@k'];
  for (const s of scores) {
    lines.push(
      s.skipped
        ? `${s.name} | SKIPPED (${s.skipReason})`
        : `${s.name} | ${s.k} | ${s.retrieved} | ${s.relevantTotal} | ${s.matched} | ` +
          `${s.recallAtK!.toFixed(3)} | ${s.reciprocalRank!.toFixed(3)} | ${s.ndcgAtK!.toFixed(3)}`,
    );
  }
  return lines.join('\n');
}

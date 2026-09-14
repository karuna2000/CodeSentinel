import { describe, expect, it } from 'vitest';
import {
  formatScoreTable,
  ndcgAtK,
  recallAtK,
  reciprocalRank,
  scoreCase,
  summarizeRun,
} from '../services/retrieval-metrics';

const RANKED = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const REL = new Set(['b', 'f', 'z']);

describe('recallAtK', () => {
  it('scores the top-k fraction of relevant ids', () => {
    // top-6 = a..f → b, f hit → 2/3
    expect(recallAtK(RANKED, REL, 6)).toBeCloseTo(2 / 3);
    // top-2 = a, b → 1/3
    expect(recallAtK(RANKED, REL, 2)).toBeCloseTo(1 / 3);
  });

  it('returns null when there is nothing relevant to find', () => {
    expect(recallAtK(RANKED, new Set(), 6)).toBeNull();
  });
});

describe('reciprocalRank', () => {
  it('returns 1/rank of the first hit', () => {
    expect(reciprocalRank(RANKED, REL)).toBeCloseTo(1 / 2); // b at rank 2
    expect(reciprocalRank(['z', 'a'], REL)).toBe(1);
  });

  it('returns 0 when nothing relevant is retrieved', () => {
    expect(reciprocalRank(['a', 'c'], REL)).toBe(0);
  });

  it('returns null on an empty relevant set', () => {
    expect(reciprocalRank(RANKED, new Set())).toBeNull();
  });
});

describe('ndcgAtK', () => {
  it('is 1 for a perfect ranking', () => {
    expect(ndcgAtK(['b', 'f', 'z'], REL, 3)).toBeCloseTo(1);
  });

  it('discounts late hits below 1', () => {
    const v = ndcgAtK(RANKED, REL, 6);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
    expect(v!).toBeLessThan(1);
  });

  it('is 0 when nothing relevant is retrieved', () => {
    expect(ndcgAtK(['a', 'c'], REL, 6)).toBe(0);
  });
});

describe('scoreCase / summarizeRun / formatScoreTable', () => {
  it('marks empty-relevant cases skipped', () => {
    const s = scoreCase('empty', RANKED, new Set());
    expect(s.skipped).toBe(true);
    expect(s.recallAtK).toBeNull();
  });

  it('macro-averages only scored cases', () => {
    const summary = summarizeRun([
      scoreCase('s1', RANKED, REL),
      scoreCase('s2', RANKED, new Set()),
    ]);
    expect(summary.cases).toBe(2);
    expect(summary.scored).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.meanRecallAtK).toBeCloseTo(2 / 3);
  });

  it('formats a readable table with skip lines', () => {
    const table = formatScoreTable([
      scoreCase('s1', RANKED, REL),
      scoreCase('s2', RANKED, new Set()),
    ]);
    expect(table).toMatch(/recall@k/);
    expect(table).toMatch(/SKIPPED/);
  });
});

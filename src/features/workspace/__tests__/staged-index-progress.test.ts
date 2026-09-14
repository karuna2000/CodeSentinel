import { describe, expect, it } from 'vitest';
import { INDEX_STAGES, stagedProgress } from '../staged-index-progress';

const TOTAL_MS = INDEX_STAGES.reduce((sum, s) => sum + s.durationMs, 0);

describe('stagedProgress', () => {
  it('starts at 0 with the first stage label', () => {
    expect(stagedProgress(0)).toEqual({ progress: 0, label: 'Fetching repository tree' });
  });

  it('interpolates within the first stage', () => {
    const half = INDEX_STAGES[0].durationMs / 2;
    const { progress } = stagedProgress(half);
    expect(progress).toBe(6); // 12 * 0.5
    expect(stagedProgress(half).label).toBe('Fetching repository tree');
  });

  it('moves to the next stage once a stage window elapses', () => {
    const afterFirst = INDEX_STAGES[0].durationMs + 1;
    const { label, progress } = stagedProgress(afterFirst);
    expect(label).toBe('Comparing with previous index');
    expect(progress).toBeGreaterThanOrEqual(12);
  });

  it('covers the full named schedule and stops at 97 at the end of it', () => {
    const { progress, label } = stagedProgress(TOTAL_MS);
    expect(progress).toBe(97);
    expect(label).toBe(INDEX_STAGES[INDEX_STAGES.length - 1].label);
  });

  it('never exceeds 97 no matter how much time elapses', () => {
    for (const elapsed of [TOTAL_MS, TOTAL_MS + 1000, 100_000, 10_000_000]) {
      const { progress } = stagedProgress(elapsed);
      expect(progress).toBeLessThanOrEqual(97);
    }
  });

  it('is monotonic — progress never decreases over time', () => {
    let prev = -1;
    for (let t = 0; t <= TOTAL_MS + 500; t += 137) {
      const { progress } = stagedProgress(t);
      expect(progress).toBeGreaterThanOrEqual(prev);
      prev = progress;
    }
  });
});
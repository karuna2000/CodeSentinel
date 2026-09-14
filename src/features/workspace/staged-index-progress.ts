export interface IndexStage {
  label: string;
  start: number;
  end: number;
  durationMs: number;
}

export const INDEX_STAGES: IndexStage[] = [
  { label: 'Fetching repository tree', start: 0, end: 12, durationMs: 800 },
  { label: 'Comparing with previous index', start: 12, end: 22, durationMs: 700 },
  { label: 'Analyzing files', start: 22, end: 68, durationMs: 2600 },
  { label: 'Building knowledge graph', start: 68, end: 90, durationMs: 2000 },
  { label: 'Generating embeddings', start: 90, end: 97, durationMs: 900 },
];

/**
 * Maps elapsed time since an indexing run started to a monotonic 0–97 stage
 * schedule. Never reaches 100: completion is only signaled by the server
 * response, so the bar always completes honestly.
 */
export function stagedProgress(
  elapsedMs: number,
  stages: IndexStage[] = INDEX_STAGES
): { progress: number; label: string } {
  let elapsed = Math.max(0, elapsedMs);
  const last = stages[stages.length - 1];

  for (const stage of stages) {
    if (elapsed <= stage.durationMs) {
      const frac = Math.min(1, elapsed / stage.durationMs);
      const progress = stage.start + (stage.end - stage.start) * frac;
      return {
        progress: Math.min(97, Math.round(progress)),
        label: stage.label,
      };
    }
    elapsed -= stage.durationMs;
  }

  return { progress: last.end, label: last.label };
}
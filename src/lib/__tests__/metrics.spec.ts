import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheEventsTotal,
  chatAnswersTotal,
  chatLatencySeconds,
  ensureMetrics,
  guardrailBlocksTotal,
  judgeVerdictsTotal,
  registry,
} from '../metrics';

describe('metrics registry', () => {
  beforeEach(() => {
    // Module-global counters: reset so repetition and cross-file pollution
    // in the same worker cannot turn absolute assertions into flakes.
    registry.resetMetrics();
  });

  it('exposes prometheus text with our counters after increments', async () => {
    chatAnswersTotal.inc({ intent: 'locate', status: 'grounded', blocked: 'false' });
    guardrailBlocksTotal.inc({ gate: 'citation_coverage' });
    judgeVerdictsTotal.inc({ pass: 'true' });
    cacheEventsTotal.inc({ result: 'hit' });
    chatLatencySeconds.observe(1.25);

    const text = await ensureMetrics().metrics();
    expect(registry.contentType).toMatch(/text\/plain/);
    expect(text).toMatch(/codesintler_chat_answers_total\{[^}]*intent="locate"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_guardrail_blocks_total\{[^}]*gate="citation_coverage"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_judge_verdicts_total\{[^}]*pass="true"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_chat_cache_events_total\{[^}]*result="hit"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_chat_latency_seconds_bucket\{[^}]*le="2.5"[^}]*\} 1/);
  });

  it('never exposes user, repo, or query labels', async () => {
    const text = await ensureMetrics().metrics();
    expect(text).not.toMatch(/user_id|repo_id|query/);
  });
});

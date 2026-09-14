import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheEventsTotal,
  chatAnswersTotal,
  chatLatencySeconds,
  ensureMetrics,
  guardrailBlocksTotal,
  indexDurationSeconds,
  indexFilesTotal,
  indexJobsTotal,
  judgeVerdictsTotal,
  recordCacheEvent,
  recordChatAnswer,
  recordChatLatency,
  recordGuardrailBlock,
  recordIndexDuration,
  recordIndexFiles,
  recordIndexJob,
  recordJudgeVerdict,
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

  it('record helpers dual-write to the Prometheus registry', async () => {
    recordChatAnswer({ intent: 'explain', status: 'grounded', blocked: 'false' });
    recordGuardrailBlock('secrets_leak');
    recordJudgeVerdict(false);
    recordCacheEvent('miss');
    recordChatLatency(0.75);

    const text = await ensureMetrics().metrics();
    expect(text).toMatch(/codesintler_chat_answers_total\{[^}]*intent="explain"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_guardrail_blocks_total\{[^}]*gate="secrets_leak"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_judge_verdicts_total\{[^}]*pass="false"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_chat_cache_events_total\{[^}]*result="miss"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_chat_latency_seconds_count( ?\{[^}]*\})? 1/);
  });

  it('records indexing outcomes without identifier labels', async () => {
    recordIndexJob('success');
    recordIndexJob('failure');
    recordIndexDuration(42, 'success');
    recordIndexFiles(287, 'success');

    const text = await ensureMetrics().metrics();
    expect(text).toMatch(/codesintler_index_jobs_total\{[^}]*outcome="success"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_index_jobs_total\{[^}]*outcome="failure"[^}]*\} 1/);
    expect(text).toMatch(/codesintler_index_duration_seconds_count\{[^}]*outcome="success"[^}]*\} 1/);
    // Cardinality rule: no repo/job ids on metric lines.
    const indexLines = text.split('\n').filter((l) => l.startsWith('codesintler_index_'));
    expect(indexLines.join('\n')).not.toMatch(/repo_id|job_?id|user_id/);
    expect(indexJobsTotal).toBeDefined();
    expect(indexDurationSeconds).toBeDefined();
    expect(indexFilesTotal).toBeDefined();
  });
});

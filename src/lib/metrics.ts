import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { metrics as otelMetrics } from '@opentelemetry/api';

/**
 * Prometheus metrics (Phase F).
 *
 * In-process registry — accurate for single-instance dev; multi-instance
 * prod should prefer the Postgres-backed dashboard (/admin/observability)
 * for exact counts. Labels are aggregate-only (intent, status, gate,
 * result): never user ids, repo ids, or query text, because /api/metrics
 * is publicly scrapable.
 */

export const registry = new Registry();
registry.setDefaultLabels({ app: 'codesintler' });

let defaultsCollected = false;
export function ensureMetrics(): Registry {
  if (!defaultsCollected) {
    collectDefaultMetrics({ register: registry, prefix: 'codesintler_' });
    defaultsCollected = true;
  }
  return registry;
}

export const chatAnswersTotal = new Counter({
  name: 'codesintler_chat_answers_total',
  help: 'Chat answers served by intent/status/blocked outcome',
  labelNames: ['intent', 'status', 'blocked'] as const,
  registers: [registry],
});

export const guardrailBlocksTotal = new Counter({
  name: 'codesintler_guardrail_blocks_total',
  help: 'Guardrail gate failures (answer replaced by fallback)',
  labelNames: ['gate'] as const,
  registers: [registry],
});

export const judgeVerdictsTotal = new Counter({
  name: 'codesintler_judge_verdicts_total',
  help: 'Post-hoc groundedness judge outcomes',
  labelNames: ['pass'] as const,
  registers: [registry],
});

export const cacheEventsTotal = new Counter({
  name: 'codesintler_chat_cache_events_total',
  help: 'Answer-cache hits, stores, skips, and store failures',
  labelNames: ['result'] as const,
  registers: [registry],
});

export const chatLatencySeconds = new Histogram({
  name: 'codesintler_chat_latency_seconds',
  help: 'End-to-end chat answer latency (pipeline, cache hits included)',
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [registry],
});

// ── OTel mirrors (S1) ───────────────────────────────────────────────────────
// Same instruments, second sink: the OTel meter is global-API based, so these
// are no-ops until the SDK registers a PeriodicExportingMetricReader
// (telemetry-sdk.ts, pointed at the SigNoz collector). Record helpers below
// write to BOTH sinks so Prometheus text and OTLP can never diverge.

const otelMeter = otelMetrics.getMeter('codesintler');

const otelChatAnswers = otelMeter.createCounter('codesintler.chat.answers', {
  description: 'Chat answers served by intent/status/blocked outcome',
});
const otelGuardrailBlocks = otelMeter.createCounter('codesintler.guardrail.blocks', {
  description: 'Guardrail gate failures (answer replaced by fallback)',
});
const otelJudgeVerdicts = otelMeter.createCounter('codesintler.judge.verdicts', {
  description: 'Post-hoc groundedness judge outcomes',
});
const otelCacheEvents = otelMeter.createCounter('codesintler.chat.cache.events', {
  description: 'Answer-cache hits, stores, skips, and store failures',
});
const otelChatLatency = otelMeter.createHistogram('codesintler.chat.latency', {
  description: 'End-to-end chat answer latency in seconds',
  unit: 's',
});

export interface AnswerLabels {
  intent: string;
  status: string;
  blocked: string;
}

export function recordChatAnswer(labels: AnswerLabels): void {
  chatAnswersTotal.inc(labels);
  otelChatAnswers.add(1, { ...labels });
}

export function recordGuardrailBlock(gate: string): void {
  guardrailBlocksTotal.inc({ gate });
  otelGuardrailBlocks.add(1, { gate });
}

export function recordJudgeVerdict(pass: boolean): void {
  const value = String(pass);
  judgeVerdictsTotal.inc({ pass: value });
  otelJudgeVerdicts.add(1, { pass: value });
}

export function recordCacheEvent(result: string): void {
  cacheEventsTotal.inc({ result });
  otelCacheEvents.add(1, { result });
}

export function recordChatLatency(seconds: number): void {
  chatLatencySeconds.observe(seconds);
  otelChatLatency.record(seconds);
}

// ── Indexing (spec §10.5) ───────────────────────────────────────────────────
// Outcome-only labels: never repo/job ids (spec §28 cardinality rule).

export const indexJobsTotal = new Counter({
  name: 'codesintler_index_jobs_total',
  help: 'Repository indexing runs by outcome',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const indexDurationSeconds = new Histogram({
  name: 'codesintler_index_duration_seconds',
  help: 'Repository indexing wall duration',
  buckets: [5, 15, 30, 60, 120, 300, 600],
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const indexFilesTotal = new Histogram({
  name: 'codesintler_index_files',
  help: 'Files present per indexing run',
  buckets: [10, 50, 150, 300, 600, 1200],
  labelNames: ['outcome'] as const,
  registers: [registry],
});

const otelIndexJobs = otelMeter.createCounter('codesintler.index.jobs', {
  description: 'Repository indexing runs by outcome',
});
const otelIndexDuration = otelMeter.createHistogram('codesintler.index.duration', {
  description: 'Repository indexing wall duration in seconds',
  unit: 's',
});
const otelIndexFiles = otelMeter.createHistogram('codesintler.index.files', {
  description: 'Files present per indexing run',
});

export type IndexOutcome = 'success' | 'failure';

export function recordIndexJob(outcome: IndexOutcome): void {
  indexJobsTotal.inc({ outcome });
  otelIndexJobs.add(1, { outcome });
}

export function recordIndexDuration(seconds: number, outcome: IndexOutcome): void {
  indexDurationSeconds.observe({ outcome }, seconds);
  otelIndexDuration.record(seconds, { outcome });
}

export function recordIndexFiles(fileCount: number, outcome: IndexOutcome): void {
  indexFilesTotal.observe({ outcome }, fileCount);
  otelIndexFiles.record(fileCount, { outcome });
}

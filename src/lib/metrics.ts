import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

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

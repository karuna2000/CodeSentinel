import type { Attributes } from '@opentelemetry/api';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getTracer } from '@/lib/tracing';
import { sanitizeTelemetryMetadata } from '@/lib/observability-sanitize';

type TraceMetadata = Record<string, unknown>;

/** Best-effort extraction — call sites use mixed key conventions. */
function pickString(meta: TraceMetadata, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/** Flatten one level for span attributes (no PII: values are truncated). */
function toSpanAttributes(meta: TraceMetadata): Attributes {
  const attrs: Attributes = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attrs[`event.${key}`] =
        typeof value === 'string' && value.length > 200 ? `${value.slice(0, 200)}…` : value;
    } else if (Array.isArray(value)) {
      attrs[`event.${key}.count`] = value.length;
    }
  }
  return attrs;
}

/**
 * Traces a custom event.
 *
 * Triple sink:
 * - Postgres (`trace_events`) — always, authoritative for /admin/observability.
 * - OpenTelemetry span (`trace.event`, immediate open/close) — flows to
 *   Langfuse via LangfuseSpanProcessor when keys are set, or to the
 *   configured OTLP endpoint. Drops silently with no SDK registered.
 * Fire-and-forget — tracing must never fail or slow the caller.
 */
export function traceEvent(name: string, metadata?: TraceMetadata): void {
  // Sanitize once: both sinks below receive only scrubbed data.
  const meta = sanitizeTelemetryMetadata(metadata ?? {});

  try {
    const span = getTracer().startSpan('trace.event', {
      attributes: { 'event.name': name, ...toSpanAttributes(meta) },
    });
    span.end();
  } catch {
    // Span export is best-effort; the DB sink below is authoritative.
  }

  // Never throw: property access on a partially-mocked db (unit tests) must
  // degrade to a silent no-op, and sink failures must not reach the caller.
  try {
    void db.traceEvent
      .create({
        data: {
          name,
          // Round-trip guarantees plain-JSON for the Json column.
          metadata: JSON.parse(JSON.stringify(meta)) as Prisma.InputJsonObject,
          user_id: pickString(meta, ['userId', 'user_id']),
          repo_id: pickString(meta, ['repoId', 'repo_id']),
        },
      })
      .catch(() => {
        // Tracing is observability, not control flow — never throw.
      });
  } catch {
    // Partial mocks / uninitialized client — silently skip the DB sink.
  }
}

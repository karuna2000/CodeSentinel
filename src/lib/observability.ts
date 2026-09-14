import { Langfuse } from 'langfuse';
import type { Prisma } from '@prisma/client';
import { env } from '@/lib/env';
import { db } from '@/lib/db';

// Initialize Langfuse only if keys are present
export const langfuse =
  env.langfuse.publicKey && env.langfuse.secretKey
    ? new Langfuse({
        publicKey: env.langfuse.publicKey,
        secretKey: env.langfuse.secretKey,
        baseUrl: env.langfuse.host,
      })
    : null;

type TraceMetadata = Record<string, unknown>;

/** Best-effort extraction — call sites use mixed key conventions. */
function pickString(meta: TraceMetadata, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Traces a custom event.
 *
 * Dual sink: Langfuse when configured (cloud mirror), always Postgres
 * (`trace_events`, the queryable source for /admin/observability).
 * Fire-and-forget — tracing must never fail or slow the caller, so the DB
 * write is unawaited and self-contained (its own failure is swallowed).
 */
export function traceEvent(name: string, metadata?: TraceMetadata): void {
  if (langfuse) {
    try {
      langfuse.trace({ name, metadata });
    } catch {
      // Cloud mirror is best-effort; the DB sink below is authoritative.
    }
  }

  const meta: TraceMetadata = metadata ?? {};
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

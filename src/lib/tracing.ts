import { trace, type Attributes, type Span, type Tracer } from '@opentelemetry/api';

/**
 * Thin OpenTelemetry helper (Phase F).
 *
 * The SDK itself is registered in `src/instrumentation.ts` (Node runtime
 * only). This module never initializes providers — it only uses the global
 * API, so it is safe to import anywhere, including unit tests (global
 * default = no-op tracer when no SDK is registered).
 *
 * Privacy rule: span attributes carry shapes, never content — query text,
 * answers, and user ids stay out of vendor traces. Counts, intents, and
 * latencies are fine.
 */

const TRACER_NAME = 'codesintler';

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Run `fn` inside a span that always ends (records exceptions as span
 * errors, then rethrows). `tracer` is injectable for unit tests.
 */
export async function withSpan<T>(
  name: string,
  attrs: Attributes,
  fn: (span: Span) => Promise<T>,
  tracer: Tracer = getTracer(),
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attrs);
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

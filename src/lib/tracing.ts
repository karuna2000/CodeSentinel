import { trace, INVALID_SPAN_CONTEXT, type Attributes, type Span, type Tracer } from '@opentelemetry/api';
import { sanitizeError } from '@/lib/observability-sanitize';
import { sanitizeTelemetryMetadata } from '@/lib/observability-sanitize';

/**
 * Thin OpenTelemetry helper (Phase F).
 *
 * The SDK itself is registered in `src/instrumentation.ts` (Node runtime
 * only). This module never initializes providers — it only uses the global
 * API, so it is safe to import anywhere, including unit tests (global
 * default = no-op tracer when no SDK is registered).
 *
 * Privacy rule: span attributes carry shapes and opaque identifiers, never
 * content or secrets — query text, answers, and raw credentials stay out of
 * vendor traces. Opaque internal ids (session sub, repo id) are permitted
 * per the identity model (spec §8: user_id as opaque ID, repository_id as
 * identifier); file paths are allowed as attributes but never as metric
 * labels. Counts, intents, and latencies are fine.
 */

import { observabilityConfig } from './observability-config';

const TRACER_NAME = 'codesintler';

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

let initPromise: Promise<boolean> | null = null;
let hookRegistered = false;

/** Called by instrumentation.ts so lazy init below doesn't double-start. */
export function markOtelRegistered(): void {
  hookRegistered = true;
}

/**
 * Lazy SDK startup for runtimes where the Next instrumentation hook doesn't
 * run (observed in `next dev`). Guarded: never in edge runtime, never under
 * vitest, never without export credentials. Resolves true when an SDK is up.
 */
export function ensureOtel(): Promise<boolean> {
  const config = observabilityConfig();
  if (!config.enabled) return Promise.resolve(false);
  if (hookRegistered) return Promise.resolve(true);
  if (initPromise) return initPromise;
  if (process.env.NEXT_RUNTIME === 'edge' || process.env.VITEST_WORKER_ID ||
      (!config.langfuse.enabled && !config.traceEndpoint)) return Promise.resolve(false);
  initPromise = (async () => {
    try {
      const { createTelemetrySDK } = await import('./telemetry-sdk');
      const sdk = await createTelemetrySDK(config);
      sdk.start();
      shutdownSDK = () => sdk.shutdown();
      hookRegistered = true;
      process.once('SIGTERM', shutdownTelemetry);
      process.once('SIGINT', shutdownTelemetry);
      return true;
    } catch {
      initPromise = null;
      return false;
    }
  })();
  return initPromise;
}

let shutdownSDK: (() => Promise<void>) | undefined;
export async function shutdownTelemetry(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      shutdownSDK?.(),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); timer.unref(); }),
    ]);
  } catch { /* Never prevent application shutdown. */ }
  finally { if (timer) clearTimeout(timer); }
}

/**
 * Run `fn` inside a span that always ends (records exceptions as span
 * errors, then rethrows). `tracer` is injectable for unit tests.
 */
export async function withSpan<T>(
  name: string,
  attrs: Attributes,
  fn: (span: Span) => Promise<T>,
  tracer?: Tracer,
): Promise<T> {
  await ensureOtel();
  const noop = trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
  if (!observabilityConfig().enabled) return fn(noop);
  const activeTracer = tracer ?? getTracer();
  let entered = false;
  try {
    return await activeTracer.startActiveSpan(name, async (span) => {
      entered = true;
      const safeSpan = new Proxy(span, {
        get(target, key) {
          const value = Reflect.get(target, key);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            try { return value.apply(target, args); } catch { return undefined; }
          };
        },
      });
      try {
        safeSpan.setAttributes(sanitizeTelemetryMetadata(attrs) as Attributes);
        return await fn(safeSpan);
      } catch (err) {
        safeSpan.recordException({ name: 'Error', message: sanitizeError(err) });
        safeSpan.setStatus({ code: 2, message: sanitizeError(err) });
        throw err;
      } finally {
        safeSpan.end();
      }
    });
  } catch (err) {
    if (entered) throw err;
    return fn(noop);
  }
}

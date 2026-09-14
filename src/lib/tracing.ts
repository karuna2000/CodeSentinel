import { trace, type Attributes, type Span, type Tracer } from '@opentelemetry/api';
import { sanitizeError, sanitizeTelemetryMetadata } from '@/lib/observability-sanitize';

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
  if (hookRegistered) return Promise.resolve(true);
  if (initPromise) return initPromise;
  if (
    process.env.NEXT_RUNTIME === 'edge' ||
    process.env.VITEST_WORKER_ID ||
    (!process.env.LANGFUSE_PUBLIC_KEY &&
      !process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  ) {
    return Promise.resolve(false);
  }
  initPromise = (async () => {
    try {
      const [{ NodeSDK }, { LangfuseSpanProcessor }] = await Promise.all([
        import('@opentelemetry/sdk-node'),
        import('@langfuse/otel'),
      ]);
      const explicitEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
      if (explicitEndpoint) {
        const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
        const sdk = new NodeSDK({
          serviceName: 'codesintler',
          traceExporter: new OTLPTraceExporter({ url: explicitEndpoint }),
        });
        sdk.start();
      } else {
        const sdk = new NodeSDK({
          serviceName: 'codesintler',
          spanProcessors: [
            new LangfuseSpanProcessor({
              publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
              secretKey: process.env.LANGFUSE_SECRET_KEY || '',
              baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
              shouldExportSpan: () => true,
            }),
          ],
        });
        sdk.start();
      }
      hookRegistered = true;
      console.log('[OTel] SDK registered (lazy init), exporting spans to Langfuse');
      return true;
    } catch {
      initPromise = null;
      return false;
    }
  })();
  return initPromise;
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
  // Lazy SDK startup: covers runtimes where the Next instrumentation hook
  // doesn't run. No-op when export isn't configured (local dev default).
  await ensureOtel();
  const activeTracer = tracer ?? getTracer();
  return activeTracer.startActiveSpan(name, async (span) => {
    try {
      // Scrubbed at the single export choke point (spec §32).
      span.setAttributes(sanitizeTelemetryMetadata(attrs) as Attributes);
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: sanitizeError(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

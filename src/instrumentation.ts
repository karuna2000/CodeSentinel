
/**
 * OpenTelemetry SDK registration (Phase F, Langfuse v4 path).
 *
 * Next.js loads this in the Node runtime before serving requests. Where the
 * hook doesn't run (observed in `next dev`), the first `withSpan` call
 * lazily starts the same SDK via `ensureOtel()` — `markOtelRegistered`
 * prevents double startup either way.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { ensureOtel, markOtelRegistered } = await import('@/lib/tracing');
  const started = await ensureOtel();
  if (started) {
    markOtelRegistered();
    console.log('[OTel] SDK registered');
  }
}

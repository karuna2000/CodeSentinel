/**
 * OpenTelemetry SDK registration (Phase F).
 *
 * Next.js loads this in the Node runtime before serving requests. Spans are
 * exported via OTLP when an endpoint is configured:
 * - explicit `OTEL_EXPORTER_OTLP_ENDPOINT`, or
 * - Langfuse OTLP ingestion when Langfuse keys are set
 *   (`{host}/api/public/otlp/v1/traces`, Basic auth public:secret).
 * With neither configured the SDK runs without a span processor (drops
 * spans) — local dev stays quiet and dependency-free at runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

  const langfusePublic = process.env.LANGFUSE_PUBLIC_KEY || '';
  const langfuseSecret = process.env.LANGFUSE_SECRET_KEY || '';
  const langfuseHost = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

  const explicitEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '';
  const langfuseEndpoint =
    langfusePublic && langfuseSecret ? `${langfuseHost}/api/public/otlp/v1/traces` : '';

  const endpoint = explicitEndpoint || langfuseEndpoint;
  if (!endpoint) return;

  const headers =
    !explicitEndpoint && langfusePublic
      ? { Authorization: `Basic ${Buffer.from(`${langfusePublic}:${langfuseSecret}`).toString('base64')}` }
      : undefined;

  const sdk = new NodeSDK({
    serviceName: 'codesintler',
    traceExporter: new OTLPTraceExporter({ url: endpoint, headers }),
  });
  sdk.start();
}

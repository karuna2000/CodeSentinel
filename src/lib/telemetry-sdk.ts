import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace';
import { SanitizingSpanProcessor } from './telemetry-processor';
import { observabilityConfig } from './observability-config';

export async function createTelemetrySDK(config = observabilityConfig()) {
  const processors: SpanProcessor[] = [];
  if (config.langfuse.enabled) {
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');
    processors.push(new SanitizingSpanProcessor(new LangfuseSpanProcessor({
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      baseUrl: config.langfuse.baseUrl,
      environment: config.environment,
      mediaUploadEnabled: false,
      shouldExportSpan: ({ otelSpan }) => ['codesintler', 'ai'].includes(otelSpan.instrumentationScope.name),
    })));
  }
  let metricReader;
  if (config.traceEndpoint) {
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    processors.push(new SanitizingSpanProcessor(new BatchSpanProcessor({
      exporter: new OTLPTraceExporter({ url: config.traceEndpoint, timeoutMillis: 2000 }),
      exportTimeoutMillis: 2000,
    })));
    // Metrics ride the same collector (traces URL → metrics URL).
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    metricReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: config.traceEndpoint.replace(/\/v1\/traces$/, '/v1/metrics'),
        timeoutMillis: 2000,
      }),
      exportIntervalMillis: 30_000,
    });
  }
  return new NodeSDK({
    serviceName: config.serviceName,
    // Explicit empty lists prevent ambient SDK defaults from creating unsanitized sinks.
    spanProcessors: processors,
    logRecordProcessors: [],
    metricReaders: metricReader ? [metricReader] : [],
    autoDetectResources: false,
  });
}

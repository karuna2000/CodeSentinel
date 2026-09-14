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
  if (config.traceEndpoint) {
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    processors.push(new SanitizingSpanProcessor(new BatchSpanProcessor({
      exporter: new OTLPTraceExporter({ url: config.traceEndpoint, timeoutMillis: 2000 }),
      exportTimeoutMillis: 2000,
    })));
  }
  return new NodeSDK({
    serviceName: config.serviceName,
    // Explicit empty lists prevent ambient SDK defaults from creating unsanitized sinks.
    spanProcessors: processors,
    logRecordProcessors: [],
    metricReaders: [],
    autoDetectResources: false,
  });
}

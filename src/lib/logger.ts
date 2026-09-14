import { trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { env } from '@/lib/env';
import { sanitizeTelemetryMetadata } from '@/lib/observability-sanitize';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Active OTel trace id for log↔trace correlation (undefined outside a span). */
export function activeTraceId(): string | undefined {
  try {
    const ctx = trace.getActiveSpan()?.spanContext();
    if (ctx && ctx.traceId !== '00000000000000000000000000000000') return ctx.traceId;
  } catch {
    // Tracing must never break logging.
  }
  return undefined;
}

const SEVERITY: Record<LogLevel, number> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/** Best-effort OTLP mirror — stdout stays the durable copy. Never throws. */
function emitOtlp(level: LogLevel, message: string, attributes: Record<string, unknown>): void {
  try {
    // OTLP attributes accept primitives only — stringify the rest.
    const flat: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(sanitizeTelemetryMetadata(attributes))) {
      flat[key] =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : JSON.stringify(value) ?? 'null';
    }
    logs
      .getLogger('codesintler')
      .emit({ severityNumber: SEVERITY[level], body: message, attributes: flat });
  } catch {
    // No SDK registered (or export unavailable) — stdout already captured it.
  }
}

function log(level: LogLevel, prefix: string, message: string, context?: Record<string, unknown>): void {
  if (level === 'debug' && env.nodeEnv !== 'development') return;

  const timestamp = new Date().toISOString();
  const trace_id = activeTraceId();

  // OTLP mirror (best-effort) + trace correlation on every record.
  emitOtlp(level, `${prefix} ${message}`, {
    ...(context ?? {}),
    ...(trace_id ? { trace_id } : {}),
  });

  if (env.isProduction) {
    // Structured JSON logging for production (Datadog, Vercel logs, etc.)
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({
        timestamp,
        level,
        prefix,
        message,
        ...(trace_id ? { trace_id } : {}),
        ...context,
      })
    );
  } else {
    // Pretty text logging for development
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${prefix} ${message}`;
    const fullContext = { ...(trace_id ? { trace_id } : {}), ...(context ?? {}) };
    if (Object.keys(fullContext).length > 0) {
      console[level === 'debug' ? 'log' : level](formatted, fullContext);
    } else {
      console[level === 'debug' ? 'log' : level](formatted);
    }
  }
}

export const logger = {
  debug: (prefix: string, message: string, context?: Record<string, unknown>) => log('debug', prefix, message, context),
  info:  (prefix: string, message: string, context?: Record<string, unknown>) => log('info',  prefix, message, context),
  warn:  (prefix: string, message: string, context?: Record<string, unknown>) => log('warn',  prefix, message, context),
  error: (prefix: string, message: string, context?: Record<string, unknown>) => log('error', prefix, message, context),
};

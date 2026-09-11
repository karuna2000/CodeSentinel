import { env } from '@/lib/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

function log(level: LogLevel, prefix: string, message: string, context?: Record<string, unknown>): void {
  if (level === 'debug' && env.nodeEnv !== 'development') return;

  const timestamp = new Date().toISOString();

  if (env.isProduction) {
    // Structured JSON logging for production (Datadog, Vercel logs, etc.)
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({
        timestamp,
        level,
        prefix,
        message,
        ...context,
      })
    );
  } else {
    // Pretty text logging for development
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${prefix} ${message}`;
    if (context && Object.keys(context).length > 0) {
      console[level === 'debug' ? 'log' : level](formatted, context);
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

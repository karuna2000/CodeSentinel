type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, prefix: string, message: string, data?: unknown): void {
  if (level === 'debug' && process.env.NODE_ENV !== 'development') return;

  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${prefix} ${message}`;

  if (data !== undefined) {
    console[level === 'debug' ? 'log' : level](formatted, data);
  } else {
    console[level === 'debug' ? 'log' : level](formatted);
  }
}

export const logger = {
  debug: (prefix: string, message: string, data?: unknown) => log('debug', prefix, message, data),
  info:  (prefix: string, message: string, data?: unknown) => log('info',  prefix, message, data),
  warn:  (prefix: string, message: string, data?: unknown) => log('warn',  prefix, message, data),
  error: (prefix: string, message: string, data?: unknown) => log('error', prefix, message, data),
};

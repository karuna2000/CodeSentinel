/** Optional configuration: malformed telemetry settings disable that sink. */
export function observabilityConfig(source: Record<string, string | undefined> = process.env) {
  const enabled = source.OBSERVABILITY_ENABLED !== 'false';
  const url = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
      return parsed.toString().replace(/\/$/, '');
    } catch { return undefined; }
  };
  const baseUrl = url(source.LANGFUSE_BASE_URL || source.LANGFUSE_HOST || 'http://localhost:3010');
  const endpoint = url(source.OTEL_EXPORTER_OTLP_ENDPOINT);
  const captureContent = source.OBS_CAPTURE_CONTENT === 'true';
  return {
    enabled,
    environment: source.APP_ENV || source.NODE_ENV || 'development',
    serviceName: source.OTEL_SERVICE_NAME || 'codesentinel-api',
    captureContent,
    capturePrompts: captureContent && source.OBS_CAPTURE_PROMPTS === 'true',
    captureCompletions: captureContent && source.OBS_CAPTURE_COMPLETIONS === 'true',
    traceEndpoint: enabled && endpoint
      ? (endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint}/v1/traces`)
      : undefined,
    langfuse: {
      enabled: enabled && source.LANGFUSE_ENABLED !== 'false' && !!baseUrl &&
        !!source.LANGFUSE_PUBLIC_KEY && !!source.LANGFUSE_SECRET_KEY,
      baseUrl,
      publicKey: source.LANGFUSE_PUBLIC_KEY || '',
      secretKey: source.LANGFUSE_SECRET_KEY || '',
    },
  };
}

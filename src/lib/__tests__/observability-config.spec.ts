import { describe, expect, it } from 'vitest';
import { observabilityConfig } from '../observability-config';

describe('observabilityConfig', () => {
  it('rejects malformed base URLs and embedded credentials', () => {
    const bad = observabilityConfig({
      LANGFUSE_BASE_URL: 'ftp://x',
    });
    expect(bad.langfuse.enabled).toBe(false);

    const creds = observabilityConfig({
      LANGFUSE_BASE_URL: 'http://user:pass@host',
    });
    expect(creds.langfuse.enabled).toBe(false);
  });

  it('suffixes the OTLP traces path and gates capture flags', () => {
    const cfg = observabilityConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
      OBS_CAPTURE_CONTENT: 'true',
      OBS_CAPTURE_PROMPTS: 'true',
    });
    expect(cfg.traceEndpoint).toBe('http://collector:4318/v1/traces');
    expect(cfg.capturePrompts).toBe(true);
    expect(cfg.captureCompletions).toBe(false);
  });

  it('requires content opt-in before prompt/completion capture', () => {
    const cfg = observabilityConfig({
      OBS_CAPTURE_PROMPTS: 'true',
    });
    expect(cfg.capturePrompts).toBe(false);
  });

  it('master switch disables all sinks', () => {
    const cfg = observabilityConfig({
      OBSERVABILITY_ENABLED: 'false',
      LANGFUSE_PUBLIC_KEY: 'pk',
      LANGFUSE_SECRET_KEY: 'sk',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://x:4318',
    });
    expect(cfg.enabled).toBe(false);
    expect(cfg.langfuse.enabled).toBe(false);
    expect(cfg.traceEndpoint).toBeUndefined();
  });

  it('accepts full valid config', () => {
    const cfg = observabilityConfig({
      LANGFUSE_BASE_URL: 'http://localhost:3010/',
      LANGFUSE_PUBLIC_KEY: 'pk',
      LANGFUSE_SECRET_KEY: 'sk',
    });
    expect(cfg.langfuse.enabled).toBe(true);
    expect(cfg.langfuse.baseUrl).toBe('http://localhost:3010');
  });
});

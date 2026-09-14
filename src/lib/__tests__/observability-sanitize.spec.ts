import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeError,
  sanitizeHeaders,
  sanitizeTelemetryMetadata,
} from '../observability-sanitize';

describe('sanitizeTelemetryMetadata', () => {
  it('removes SDK content and raw exception attributes at the export boundary', () => {
    const result = sanitizeTelemetryMetadata({
      'ai.prompt.messages': '[{"content":"private repository code"}]',
      'ai.response.text': 'private answer',
      'exception.message': 'provider echoed private code',
      'exception.stacktrace': 'private stack',
      code_snippet: 'private code',
      accessToken: 'opaque credential',
      'ai.model.id': 'model',
      'ai.usage.inputTokens': 123,
    });
    expect(result).toEqual({ 'ai.model.id': 'model', 'ai.usage.inputTokens': 123 });
  });
  it('removes secret-bearing keys case-insensitively, keeps approved metadata', () => {
    const result = sanitizeTelemetryMetadata({
      authorization: 'Bearer secret',
      repository_id: 'repo_1',
      PASSWORD: 'hunter2',
      intent: 'locate',
    });
    expect(result.authorization).toBeUndefined();
    expect(result.PASSWORD).toBeUndefined();
    expect(result.repository_id).toBe('repo_1');
    expect(result.intent).toBe('locate');
  });

  it('drops code-content keys by default', () => {
    const result = sanitizeTelemetryMetadata({
      intent: 'explain',
      prompt: 'You are...',
      chunk_content: 'function foo() {}',
      answer: 'The answer is...',
      query: 'How does auth work?',
    });
    expect(result.intent).toBe('explain');
    expect(result.prompt).toBeUndefined();
    expect(result.chunk_content).toBeUndefined();
    expect(result.answer).toBeUndefined();
    expect(result.query).toBeUndefined();
  });

  it('permits content keys under explicit opt-in only', () => {
    const result = sanitizeTelemetryMetadata(
      { prompt: 'You are...' },
      { allowContent: true },
    );
    expect(result.prompt).toBe('You are...');
  });

  it('redacts secret-shaped values even under innocent keys', () => {
    const result = sanitizeTelemetryMetadata({
      note: 'deploy with ghp_abcdefghijklmnopqrstuvwx please',
      key_block: '-----BEGIN RSA PRIVATE KEY-----\nabc',
    });
    expect(result.note).toBe('[REDACTED_SECRET]');
    expect(result.key_block).toBe('[REDACTED_SECRET]');
  });

  it('truncates long strings and scrubs nested objects/arrays', () => {
    const long = 'x'.repeat(1000);
    const result = sanitizeTelemetryMetadata({
      label: long,
      nested: { password: 'x', repo: 'r' },
      list: ['a', 'ghp_abcdefghijklmnopqrstuvwx'],
    });
    expect((result.label as string).length).toBeLessThan(1000);
    expect((result.nested as Record<string, unknown>).password).toBeUndefined();
    expect((result.list as unknown[])[1]).toBe('[REDACTED_SECRET]');
  });

  it('never throws on hostile input', () => {
    expect(sanitizeTelemetryMetadata(null as never)).toEqual({});
    expect(
      sanitizeTelemetryMetadata({ get x(): unknown { throw new Error('evil'); } }),
    ).toEqual({});
  });
});

describe('sanitizeError', () => {
  it('redacts secrets echoed in error messages and caps length', () => {
    expect(sanitizeError(new Error('connect AKIAIOSFODNN7EXAMPLE failed'))).toBe('[REDACTED_SECRET]');
    expect(sanitizeError(new Error('plain failure'))).toBe('plain failure');
    expect(sanitizeError('x'.repeat(1000)).length).toBeLessThanOrEqual(500);
  });
});

describe('sanitizeHeaders', () => {
  it('keeps only operational headers, case-insensitively', () => {
    expect(
      sanitizeHeaders({
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
        Cookie: 'session=abc',
        'X-Custom': '1',
      }),
    ).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('capture flags and shapes', () => {
  it('retains AI content keys only under explicit capture flags', () => {
    const input = { 'ai.prompt.messages': [{ role: 'user' }] };
    expect(sanitizeTelemetryMetadata(input)).toEqual({});
    vi.stubEnv('OBS_CAPTURE_CONTENT', 'true');
    vi.stubEnv('OBS_CAPTURE_PROMPTS', 'true');
    try {
      expect(sanitizeTelemetryMetadata(input)).toEqual(input);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('redacts Bearer tokens and credentialed URLs', () => {
    expect(
      sanitizeTelemetryMetadata({ note: 'call Bearer abcDEF123-_.~+/ end' }),
    ).toEqual({ note: '[REDACTED_SECRET]' });
    expect(
      sanitizeTelemetryMetadata({ dsn: 'postgres://bob:hunter2@db:5432/app' }),
    ).toEqual({ dsn: '[REDACTED_SECRET]' });
    expect(
      sanitizeTelemetryMetadata({ key: 'nvapi-0123456789abcdef0123456789' }),
    ).toEqual({ key: '[REDACTED_SECRET]' });
  });

  it('truncates long strings with the length suffix and caps arrays', () => {
    const out = sanitizeTelemetryMetadata({ blob: 'y'.repeat(501), list: Array(60).fill('a') });
    expect(out.blob).toBe(`y`.repeat(200) + `…[truncated 501 chars]`);
    expect((out.list as unknown[]).length).toBe(50);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Span } from '@opentelemetry/api';
import { withSpan } from '../tracing';

function fakeTracer(spans: Array<Record<string, unknown>>) {
  const span = {
    setAttributes: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(() => {
      spans.push({ ended: true });
    }),
  };
  return {
    span,
    tracer: {
      startActiveSpan: vi.fn((_name: string, fn: (s: Span) => Promise<unknown>) =>
        fn(span as unknown as Span),
      ),
    },
  };
}

describe('withSpan', () => {
  it('runs the fn, sets attributes, and always ends the span', async () => {
    const ended: Array<Record<string, unknown>> = [];
    const { tracer, span } = fakeTracer(ended);

    const result = await withSpan(
      'test.op',
      { intent: 'locate' },
      async () => 'ok',
      tracer as never,
    );

    expect(result).toBe('ok');
    expect(span.setAttributes).toHaveBeenCalledWith({ intent: 'locate' });
    expect(span.end).toHaveBeenCalledTimes(1);
    expect(ended).toHaveLength(1);
  });

  it('records exceptions, marks error status, rethrows, and still ends', async () => {
    const ended: Array<Record<string, unknown>> = [];
    const { tracer, span } = fakeTracer(ended);

    await expect(
      withSpan('test.fail', {}, async () => {
        throw new Error('boom');
      }, tracer as never),
    ).rejects.toThrow('boom');

    expect(span.recordException).toHaveBeenCalledTimes(1);
    expect(span.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2 }),
    );
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});

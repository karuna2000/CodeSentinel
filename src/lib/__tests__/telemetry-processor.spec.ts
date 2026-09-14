import { describe, expect, it, vi } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { SanitizingSpanProcessor } from '../telemetry-processor';

function fakeSpan(attrs: Record<string, unknown> = {}) {
  return {
    name: 'test',
    kind: 0,
    spanContext: () => ({ traceId: 't', spanId: 's', traceFlags: 1 }),
    parentSpanContext: undefined,
    startTime: [0, 0],
    endTime: [0, 1],
    duration: [0, 1],
    ended: true,
    resource: {},
    instrumentationScope: { name: 'test' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    attributes: attrs,
    status: { code: 0, message: 'boomoposecret ghp_abcdefghijklmnopqrstuvwx' },
    events: [],
    links: [],
  } as unknown as ReadableSpan;
}

describe('SanitizingSpanProcessor', () => {
  it('scrubs attributes and status before delegating', async () => {
    const onEnd = vi.fn();
    const proc = new SanitizingSpanProcessor({ onEnd } as never);
    await proc.onEnd(fakeSpan({ authorization: 'Bearer x', repo: 'r1' }));
    const forwarded = onEnd.mock.calls[0][0] as ReadableSpan;
    expect(forwarded.attributes).toEqual({ repo: 'r1' });
    expect(JSON.stringify(forwarded)).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
  });

  it('never throws when the delegate throws', async () => {
    const proc = new SanitizingSpanProcessor({
      onEnd: () => {
        throw new Error('sink down');
      },
    } as never);
    expect(() => proc.onEnd(fakeSpan())).not.toThrow();
    await expect(proc.forceFlush()).resolves.toBeUndefined();
    await expect(proc.shutdown()).resolves.toBeUndefined();
  });
});

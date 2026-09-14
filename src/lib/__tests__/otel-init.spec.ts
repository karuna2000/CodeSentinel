import { describe, expect, it } from 'vitest';
import { ensureOtel } from '../tracing';

describe('ensureOtel failure isolation', () => {
  it('resolves false without export credentials (observability disabled)', async () => {
    await expect(ensureOtel()).resolves.toBe(false);
  });

  it('never throws, even repeatedly (init failure resets, never wedges)', async () => {
    await expect(ensureOtel()).resolves.toBe(false);
    await expect(ensureOtel()).resolves.toBe(false);
  });
});

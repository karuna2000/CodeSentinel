import { afterEach, describe, expect, it, vi } from 'vitest';
import { withResilience } from '../resilience';

describe('withResilience timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves fast operations without tripping the ceiling', async () => {
    await expect(withResilience(async () => 'ok', 'test', 5000)).resolves.toBe('ok');
  });

  it('fails fast on hung providers instead of wedging (retries then throws)', async () => {
    vi.useFakeTimers();
    const hanging = () => new Promise<string>(() => {});
    const pending = withResilience(hanging, 'test', 50);
    const assertion = expect(pending).rejects.toThrow(/exceeded 50ms/);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withResilience: vi.fn(),
  recordUsage: vi.fn(),
}));

vi.mock('@/lib/llm/resilience', () => ({
  withResilience: mocks.withResilience,
}));

vi.mock('@/lib/llm/metering', () => ({
  recordUsage: mocks.recordUsage,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { judgeGroundedness } from '../services/groundedness-judge';

describe('judgeGroundedness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordUsage.mockResolvedValue(undefined);
  });

  it('maps the model verdict through (fail stays fail)', async () => {
    mocks.withResilience.mockResolvedValue({
      object: { pass: false, reason: 'mentions foo()' },
      usage: { inputTokens: 5, outputTokens: 2 },
    });
    const v = await judgeGroundedness('answer mentions foo()', 'ctx', {
      userId: 'u',
      repoId: 'r',
    });
    expect(v).toEqual({ pass: false, reason: 'mentions foo()', judged: true });
    expect(mocks.recordUsage).toHaveBeenCalledTimes(1);
  });

  it('fails open when the model call throws', async () => {
    mocks.withResilience.mockRejectedValue(new Error('provider down'));
    const v = await judgeGroundedness('answer', 'ctx', { userId: 'u', repoId: 'r' });
    expect(v).toEqual({ pass: true, reason: 'judge-unavailable', judged: false });
  });

  it('still returns the verdict when usage metering throws', async () => {
    mocks.withResilience.mockResolvedValue({
      object: { pass: true, reason: 'grounded' },
      usage: { inputTokens: 5, outputTokens: 2 },
    });
    mocks.recordUsage.mockRejectedValue(new Error('db down'));
    const v = await judgeGroundedness('answer', 'ctx', { userId: 'u', repoId: 'r' });
    expect(v.pass).toBe(true);
    expect(v.judged).toBe(true);
  });
});

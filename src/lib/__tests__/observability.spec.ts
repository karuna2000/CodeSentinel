import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { traceEvent: { create: mocks.create } },
}));

vi.mock('langfuse', () => ({
  Langfuse: vi.fn(),
}));

import { traceEvent } from '@/lib/observability';

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('traceEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it('persists the event with extracted user/repo columns', async () => {
    traceEvent('chat_gated', { userId: 'u1', repoId: 'r1', blocked: false });
    await flush();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        name: 'chat_gated',
        metadata: { userId: 'u1', repoId: 'r1', blocked: false },
        user_id: 'u1',
        repo_id: 'r1',
      },
    });
  });

  it('tolerates snake_case key conventions', async () => {
    traceEvent('repository_removed', { user_id: 'u2', repo_id: 'r2' });
    await flush();

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ user_id: 'u2', repo_id: 'r2' }) }),
    );
  });

  it('never throws when the sink fails', async () => {
    mocks.create.mockRejectedValue(new Error('db down'));
    expect(() => traceEvent('chat_gated', { userId: 'u1' })).not.toThrow();
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  answerQuestion: vi.fn(),
  checkRateLimit: vi.fn(),
  checkUsageBudget: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/features/chat/services/chat-pipeline', () => ({
  answerQuestion: mocks.answerQuestion,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/lib/llm/metering', () => ({
  checkUsageBudget: mocks.checkUsageBudget,
  buildUsageExceededResponse: (used: number, cap: number) =>
    new Response(JSON.stringify({ error: `cap ${used}/${cap}` }), { status: 429 }),
}));

vi.mock('@/lib/security', () => ({
  buildRateLimitedResponse: (ms: number) =>
    new Response(JSON.stringify({ error: `limited ${ms}` }), { status: 429 }),
}));

vi.mock('@/lib/db', () => ({
  db: { repository: { findFirst: mocks.findFirst } },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/env', () => ({
  env: { demo: { repoIds: ['repo-demo'] } },
}));

import { POST } from '../route';

function req(query: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/demo/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ query }),
  });
}

describe('POST /api/demo/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    mocks.checkUsageBudget.mockResolvedValue({ allowed: true, usedTokens: 0, capTokens: 0 });
    mocks.findFirst.mockResolvedValue({
      id: 'repo-demo',
      owner: 'acme',
      name: 'demo',
      description: null,
      commit_sha: 'sha',
    });
    mocks.answerQuestion.mockResolvedValue({
      text: 'answer [E1]',
      meta: { intent: 'locate', status: 'grounded', blocked: false },
    });
  });

  it('serves the allowlisted repo without a session', async () => {
    const res = await POST(req('Where is auth?'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('answer [E1]');
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['repo-demo'] } } }),
    );
    expect(mocks.answerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-demo',
        history: [],
        useCache: true,
        persist: true,
        actorId: expect.stringMatching(/^demo:[0-9a-f]{16}$/),
      }),
    );
  });

  it('hashes the client IP (raw IP never becomes the actor id)', async () => {
    await POST(req('q', '9.9.9.9'));
    const actorId = mocks.answerQuestion.mock.calls[0][0].actorId as string;
    expect(actorId).not.toContain('9.9.9.9');
    expect(actorId).toMatch(/^demo:[0-9a-f]{16}$/);
  });

  it('returns 429 when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    const res = await POST(req('q'));
    expect(res.status).toBe(429);
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });

  it('returns 503 when the demo repo is not indexed', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await POST(req('q'));
    expect(res.status).toBe(503);
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });

  it.each([
    ['', 400],
    ['   ', 400],
    ['x'.repeat(4001), 400],
  ])('rejects invalid queries (%s)', async (query, status) => {
    const res = await POST(req(query));
    expect(res.status).toBe(status);
  });

  it('hides internals on pipeline failure', async () => {
    mocks.answerQuestion.mockRejectedValue(new Error('connection string postgres://secret'));
    const res = await POST(req('q'));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('postgres://secret');
  });
});

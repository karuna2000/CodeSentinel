import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAggregate = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    llmUsage: {
      aggregate: mockAggregate,
      create: mockCreate,
    },
  },
}));

type MeteringModule = typeof import('@/lib/llm/metering');

async function loadModule(capTokens?: number): Promise<MeteringModule> {
  if (capTokens === undefined) {
    delete process.env.LLM_BUDGET_DAILY_TOKENS;
  } else {
    process.env.LLM_BUDGET_DAILY_TOKENS = String(capTokens);
  }
  vi.resetModules();
  return import('@/lib/llm/metering');
}

beforeEach(() => {
  mockAggregate.mockReset();
  mockCreate.mockReset();
});

describe('checkUsageBudget', () => {
  it('allows everything when no cap is configured', async () => {
    const { checkUsageBudget } = await loadModule();
    const budget = await checkUsageBudget('user-1');
    expect(budget.allowed).toBe(true);
    expect(budget.capTokens).toBe(0);
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('allows when the user is under the cap', async () => {
    mockAggregate.mockResolvedValue({ _sum: { total_tokens: 40_000 } });
    const { checkUsageBudget } = await loadModule(100_000);

    const budget = await checkUsageBudget('user-1');
    expect(budget.allowed).toBe(true);
    expect(budget.usedTokens).toBe(40_000);
    expect(budget.remainingTokens).toBe(60_000);
    expect(mockAggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({ user_id: 'user-1' }),
      _sum: { total_tokens: true },
    });
  });

  it('blocks when the user has hit the cap', async () => {
    mockAggregate.mockResolvedValue({ _sum: { total_tokens: 100_000 } });
    const { checkUsageBudget } = await loadModule(100_000);

    const budget = await checkUsageBudget('user-1');
    expect(budget.allowed).toBe(false);
    expect(budget.remainingTokens).toBe(0);
  });
});

describe('recordUsage', () => {
  it('persists normalized token counts', async () => {
    mockCreate.mockResolvedValue({ id: 'u' });
    const { recordUsage } = await loadModule();

    await recordUsage({ inputTokens: 100, outputTokens: 50 }, {
      userId: 'user-1',
      repoId: 'repo-1',
      feature: 'chat',
      model: 'minimaxai/minimax-m3',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        repo_id: 'repo-1',
        feature: 'chat',
        model: 'minimaxai/minimax-m3',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      },
    });
  });

  it('clamps negative/NaN token counts to zero', async () => {
    mockCreate.mockResolvedValue({ id: 'u' });
    const { recordUsage } = await loadModule();

    await recordUsage({ inputTokens: -5, outputTokens: Number.NaN }, {
      userId: 'user-1',
      feature: 'reasoning',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        repo_id: null,
      }),
    });
  });
});

describe('buildUsageExceededResponse', () => {
  it('returns a 429 with a clear message', async () => {
    const { buildUsageExceededResponse } = await loadModule();
    const res = buildUsageExceededResponse(100_000, 100_000);

    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await res.json();
    expect(body.error).toContain('Daily AI usage cap reached');
    expect(body.error).toContain('tomorrow');
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  classifyIntent: vi.fn(),
  retrieveContext: vi.fn(),
  formatContextString: vi.fn(() => 'ctx'),
  buildEvidenceIndex: vi.fn(() => []),
  streamText: vi.fn(),
  withResilience: vi.fn(),
  getCacheClient: vi.fn(),
  getCachedAnswer: vi.fn(),
  setCachedAnswer: vi.fn(),
  judgeGroundedness: vi.fn(),
  chatHistoryCreate: vi.fn(),
  traceEvent: vi.fn(),
}));

vi.mock('@/features/chat/agent/classify-intent', () => ({
  classifyIntent: mocks.classifyIntent,
}));

vi.mock('@/features/context-engine/services/hybrid-retriever', () => ({
  retrieveContext: mocks.retrieveContext,
}));

vi.mock('@/features/context-engine/services/budget-manager', () => ({
  formatContextString: mocks.formatContextString,
  buildEvidenceIndex: mocks.buildEvidenceIndex,
}));

vi.mock('ai', () => ({
  streamText: mocks.streamText,
}));

vi.mock('@/lib/llm/resilience', () => ({
  withResilience: mocks.withResilience,
}));

vi.mock('@/lib/cache/chat-cache', () => ({
  buildCacheKey: (r: string, c: string | null, q: string) => `key:${r}:${c}:${q}`,
  getCacheClient: mocks.getCacheClient,
  getCachedAnswer: mocks.getCachedAnswer,
  setCachedAnswer: mocks.setCachedAnswer,
}));

vi.mock('@/features/chat/services/groundedness-judge', () => ({
  judgeGroundedness: mocks.judgeGroundedness,
}));

vi.mock('@/lib/db', () => ({
  db: { chatHistory: { create: mocks.chatHistoryCreate } },
}));

vi.mock('@/lib/observability', () => ({
  traceEvent: mocks.traceEvent,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  answerQuestion,
  buildChatResponse,
  buildFollowUps,
  computeStatus,
  extractTurnText,
} from '../services/chat-pipeline';
import { BLOCKED_FALLBACK } from '../services/guardrails';
import { parseChatMeta } from '../lib/chat-meta';

function node(id: string, name = 'fn') {
  return {
    id, repo_id: 'r1', file_id: 'f1', type: 'FUNCTION', name,
    code_snippet: `${name}() {}`, signature: null, documentation: null,
    start_line: 1, end_line: 2, start_byte: 0, end_byte: 10,
    content_hash: 'h', created_at: new Date(),
  };
}

describe('extractTurnText', () => {
  it('joins only text parts, falls back to content', () => {
    expect(
      extractTurnText({ parts: [{ type: 'text', text: 'a' }, { type: 'tool', text: 'x' }] }),
    ).toBe('a');
    expect(extractTurnText({ parts: [], content: 'c' })).toBe('c');
    expect(extractTurnText({})).toBe('');
  });
});

describe('computeStatus', () => {
  it.each([
    [0, 'not_found'],
    [1, 'limited_evidence'],
    [2, 'grounded'],
    [20, 'grounded'],
  ])('%i → %s', (count, expected) => {
    expect(computeStatus(count)).toBe(expected);
  });
});

describe('buildFollowUps', () => {
  it('interpolates the top symbol and caps at 4', () => {
    const qs = buildFollowUps('locate', ['verifyJWT'], true);
    expect(qs).toContain('What does verifyJWT do?');
    expect(qs.length).toBeLessThanOrEqual(4);
  });

  it('still returns questions without evidence', () => {
    const qs = buildFollowUps('explain', [], false);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(4);
  });
});

describe('buildChatResponse round-trip', () => {
  it('survives parseChatMeta including non-ASCII text', async () => {
    const meta = {
      intent: 'explain' as const,
      status: 'grounded' as const,
      evidence: [],
      followUps: [],
      stats: {},
      blocked: false,
      gates: [],
    };
    const res = buildChatResponse('Grüße aus München [E1] ✓', meta);
    expect(await res.text()).toBe('Grüße aus München [E1] ✓');
    expect(parseChatMeta(res)?.intent).toBe('explain');
  });
});

describe('answerQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classifyIntent.mockResolvedValue({
      intent: 'locate',
      searchTerms: ['auth'],
      confident: true,
    });
    mocks.retrieveContext.mockResolvedValue({
      nodes: [node('n1', 'verifyJWT'), node('n2', 'authMw')],
      edges: [],
      stats: { lexicalHits: 1, semanticHits: 1, graphExpanded: 0 },
    });
    mocks.buildEvidenceIndex.mockReturnValue([
      { id: 'E1', filePath: 'a.ts', nodeName: 'verifyJWT', startLine: 1, endLine: 2 },
    ] as never);
    mocks.withResilience.mockImplementation(async (fn: (m: unknown) => unknown) => fn({}));
    mocks.streamText.mockReturnValue({
      text: Promise.resolve('verifyJWT validates tokens [E1]. '.repeat(8)),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
    });
    mocks.getCacheClient.mockResolvedValue({});
    mocks.getCachedAnswer.mockResolvedValue(null);
    mocks.setCachedAnswer.mockResolvedValue(true);
    mocks.judgeGroundedness.mockResolvedValue({ pass: true, reason: 'ok', judged: true });
    mocks.chatHistoryCreate.mockResolvedValue({});
  });

  const base = {
    repoId: 'r1',
    commitSha: 'sha',
    actorId: 'u1',
    query: 'Where is auth?',
    history: [],
    useCache: true,
    persist: true,
  };

  it('serves a grounded answer and stores it in cache', async () => {
    const result = await answerQuestion(base);
    expect(result.meta.blocked).toBe(false);
    expect(result.meta.intent).toBe('locate');
    expect(mocks.retrieveContext).toHaveBeenCalled();
    expect(mocks.setCachedAnswer).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mocks.chatHistoryCreate).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on cache hit without touching the LLM', async () => {
    mocks.getCachedAnswer.mockResolvedValue({
      text: 'cached [E1]',
      intent: 'locate',
      status: 'grounded',
      evidence: [],
      followUps: [],
      stats: {},
      gates: [],
    });
    const result = await answerQuestion(base);
    expect(result.text).toBe('cached [E1]');
    expect(result.meta.blocked).toBe(false);
    expect(mocks.classifyIntent).not.toHaveBeenCalled();
    expect(mocks.retrieveContext).not.toHaveBeenCalled();
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it('blocks uncited substantive answers and never caches them', async () => {
    mocks.streamText.mockReturnValue({
      text: Promise.resolve(
        'verifyJWT validates tokens and expiry on every request cycle through the middleware chain, rejecting expired credentials with appropriate status codes.',
      ),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
    });
    const result = await answerQuestion(base);
    expect(result.text).toBe(BLOCKED_FALLBACK);
    expect(result.meta.blocked).toBe(true);
    expect(mocks.setCachedAnswer).not.toHaveBeenCalled();
    expect(mocks.judgeGroundedness).not.toHaveBeenCalled();
  });

  it('skips cache and persistence when disabled', async () => {
    await answerQuestion({ ...base, useCache: false, persist: false });
    // Null client short-circuits to a miss by design; nothing stored.
    expect(mocks.getCacheClient).not.toHaveBeenCalled();
    expect(mocks.setCachedAnswer).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(mocks.chatHistoryCreate).not.toHaveBeenCalled();
  });
});

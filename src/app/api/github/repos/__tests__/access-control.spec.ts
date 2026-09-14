import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  syncUserRepositories: vi.fn(),
  serializeRepositories: vi.fn((repos: unknown) => repos),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUniqueNode: vi.fn(),
  findUniqueFile: vi.fn(),
  transaction: vi.fn(),
  retrieveContext: vi.fn(),
  formatContextString: vi.fn(() => 'preview'),
  classifyIntent: vi.fn(),
  buildInvestigationPlan: vi.fn(() => ({
    graph: { enabled: true, direction: 'both', maxHops: 1, relations: null },
    resultLimit: 15,
  })),
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  }),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/db', () => ({
  db: {
    repository: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
    graphNode: { findUnique: mocks.findUniqueNode },
    file: { findUnique: mocks.findUniqueFile },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/features/github/indexer/repo-sync', () => ({
  syncUserRepositories: mocks.syncUserRepositories,
  serializeRepositories: mocks.serializeRepositories,
}));

vi.mock('@/features/context-engine/services/hybrid-retriever', () => ({
  retrieveContext: mocks.retrieveContext,
}));

vi.mock('@/features/context-engine/services/budget-manager', () => ({
  formatContextString: mocks.formatContextString,
}));

vi.mock('@/features/chat/agent/classify-intent', () => ({
  classifyIntent: mocks.classifyIntent,
}));

vi.mock('@/features/chat/agent/build-investigation-plan', () => ({
  buildInvestigationPlan: mocks.buildInvestigationPlan,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/observability', () => ({
  traceEvent: vi.fn(),
}));

import { GET as listRepos, POST as syncRepos } from '../route';
import { POST as queryRepo } from '../[repoId]/query/route';
import { GET as getEvidence } from '../[repoId]/chat/evidence/route';
import { POST as deleteBatch } from '../delete-batch/route';

function asUser(id: string) {
  mocks.getServerSession.mockResolvedValue({ user: { id } });
}

describe('GET/POST /api/github/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.serializeRepositories.mockImplementation((repos: unknown) => repos);
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
    });
  });

  it('GET lists the database and never syncs GitHub', async () => {
    asUser('user-a');
    mocks.findMany.mockResolvedValue([{ id: 'repo-1' }]);

    const res = await listRepos(new Request('http://localhost/api/github/repos'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.repositories).toEqual([{ id: 'repo-1' }]);
    expect(mocks.syncUserRepositories).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-a' } }),
    );
  });

  it('POST syncs installations into the local table', async () => {
    asUser('user-a');
    mocks.syncUserRepositories.mockResolvedValue([{ id: 'repo-1' }]);

    const res = await syncRepos();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.syncUserRepositories).toHaveBeenCalled();
    expect(body.repositories).toEqual([{ id: 'repo-1' }]);
  });
});

describe('POST /api/github/repos/[repoId]/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
    });
  });

  it('returns 404 and does not retrieve another user\'s repo', async () => {
    asUser('user-b');
    mocks.findFirst.mockResolvedValue(null);

    const res = await queryRepo(
      new Request('http://localhost/api/github/repos/repo-a/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Where is auth?' }),
      }),
      { params: Promise.resolve({ repoId: 'repo-a' }) },
    );

    expect(res.status).toBe(404);
    expect(mocks.retrieveContext).not.toHaveBeenCalled();
    expect(mocks.classifyIntent).not.toHaveBeenCalled();
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'repo-a', user_id: 'user-b' },
      select: { id: true },
    });
  });

  it('retrieves context when the session user owns the repo', async () => {
    asUser('user-a');
    mocks.findFirst.mockResolvedValue({ id: 'repo-a' });
    mocks.classifyIntent.mockResolvedValue({
      intent: 'locate',
      searchTerms: ['auth'],
      directionHint: undefined,
      confident: true,
    });
    mocks.retrieveContext.mockResolvedValue({ nodes: [{ id: 'n1' }], edges: [] });

    const res = await queryRepo(
      new Request('http://localhost/api/github/repos/repo-a/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Where is auth?' }),
      }),
      { params: Promise.resolve({ repoId: 'repo-a' }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.retrieveContext).toHaveBeenCalled();
  });
});

describe('GET /api/github/repos/[repoId]/chat/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
    });
  });

  it('returns 404 when the repo is not owned by the session user', async () => {
    asUser('user-b');
    mocks.findFirst.mockResolvedValue(null);

    const res = await getEvidence(
      new NextRequest(
        'http://localhost/api/github/repos/repo-a/chat/evidence?nodeId=node-1',
      ),
      { params: Promise.resolve({ repoId: 'repo-a' }) },
    );

    expect(res.status).toBe(404);
    expect(mocks.findUniqueNode).not.toHaveBeenCalled();
  });

  it('returns 404 when the node belongs to a different repo', async () => {
    asUser('user-a');
    mocks.findFirst.mockResolvedValue({ id: 'repo-a' });
    mocks.findUniqueNode.mockResolvedValue({
      id: 'node-1',
      repo_id: 'repo-other',
      file_id: null,
      name: 'secret',
      type: 'FUNCTION',
      signature: null,
      code_snippet: 'secret()',
      start_line: 1,
      end_line: 2,
      documentation: null,
    });

    const res = await getEvidence(
      new NextRequest(
        'http://localhost/api/github/repos/repo-a/chat/evidence?nodeId=node-1',
      ),
      { params: Promise.resolve({ repoId: 'repo-a' }) },
    );

    expect(res.status).toBe(404);
    expect(mocks.findUniqueFile).not.toHaveBeenCalled();
  });
});

describe('POST /api/github/repos/delete-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes only owned ids inside a transaction', async () => {
    asUser('user-a');
    mocks.findMany.mockResolvedValue([
      { id: 'owned-1', owner: 'acme', name: 'app' },
    ]);

    const tx = {
      generationJob: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      repository: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    mocks.transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    );

    const res = await deleteBatch(
      new Request('http://localhost/api/github/repos/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoIds: ['owned-1', 'someone-else'] }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(tx.generationJob.deleteMany).toHaveBeenCalledWith({
      where: { repo_id: { in: ['owned-1'] } },
    });
    expect(tx.repository.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['owned-1'] }, user_id: 'user-a' },
    });
    expect(body.deleted).toBe(1);
    expect(body.skipped).toBe(1);
  });

  it('returns 404 when none of the ids belong to the user', async () => {
    asUser('user-b');
    mocks.findMany.mockResolvedValue([]);

    const res = await deleteBatch(
      new Request('http://localhost/api/github/repos/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoIds: ['repo-a'] }),
      }),
    );

    expect(res.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

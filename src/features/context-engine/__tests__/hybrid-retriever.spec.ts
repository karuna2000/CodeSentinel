import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    graphEdge: { findMany: vi.fn() },
    graphNode: { findMany: vi.fn() },
    repository: { findUnique: vi.fn() },
    file: { findMany: vi.fn() },
  },
}));

vi.mock('../services/embedding-service', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

import { db } from '@/lib/db';
import { retrieveContext } from '../services/hybrid-retriever';

type NodeRow = {
  id: string;
  repo_id: string;
  file_id: string | null;
  type: string;
  name: string;
  code_snippet: string | null;
  signature: string | null;
  documentation: string | null;
  start_line: number | null;
  end_line: number | null;
  start_byte: number | null;
  end_byte: number | null;
  content_hash: string | null;
  created_at: Date;
};

function makeNode(id: string, name: string, type = 'FILE'): NodeRow {
  return {
    id,
    repo_id: 'r1',
    file_id: id === 'file-a' ? 'fa' : 'fx',
    type,
    name,
    code_snippet: null,
    signature: null,
    documentation: null,
    start_line: null,
    end_line: null,
    start_byte: null,
    end_byte: null,
    content_hash: null,
    created_at: new Date(),
  };
}

type EdgeRow = {
  id: string;
  repo_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  source_line: number | null;
  source_file: string | null;
  metadata: Record<string, string> | null;
  created_at: Date;
};

function makeEdge(id: string, source: string, target: string, type: string): EdgeRow {
  return {
    id,
    repo_id: 'r1',
    source_node_id: source,
    target_node_id: target,
    type,
    source_line: null,
    source_file: null,
    metadata: null,
    created_at: new Date(),
  };
}

const mock = db as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
  graphEdge: { findMany: ReturnType<typeof vi.fn> };
  graphNode: { findMany: ReturnType<typeof vi.fn> };
  repository: { findUnique: ReturnType<typeof vi.fn> };
  file: { findMany: ReturnType<typeof vi.fn> };
};

const REPO_ID = 'r1';

beforeEach(() => {
  vi.clearAllMocks();
  mock.repository.findUnique.mockResolvedValue(null);
  mock.file.findMany.mockResolvedValue([]);
});

describe('hybrid-retriever — RRF fusion', () => {
  it('ranks nodes shared by keyword + semantic above single-source hits', async () => {
    const A = makeNode('a', 'Auth', 'FUNCTION');
    const B = makeNode('b', 'Middleware', 'FUNCTION');
    const C = makeNode('c', 'Session', 'FUNCTION');

    // Keyword: [A, B] ranked; Semantic: [B, C] ranked (B overlaps).
    mock.$queryRaw
      .mockResolvedValueOnce([A, B])
      .mockResolvedValueOnce([B, C]);
    mock.graphEdge.findMany.mockResolvedValue([]);

    const context = await retrieveContext(REPO_ID, ['auth'], 'auth flow');

    expect(context.nodes.map((n) => n.name)).toEqual(['Middleware', 'Auth', 'Session']);
  });

  it('resolves source file paths for retrieved nodes', async () => {
    const symbol = makeNode('a', 'Auth', 'FUNCTION');
    mock.$queryRaw.mockResolvedValueOnce([symbol]).mockResolvedValueOnce([]);
    mock.graphEdge.findMany.mockResolvedValue([]);
    mock.file.findMany.mockImplementation(async ({ where }: { where?: { id?: { in: string[] } } }) => {
      const ids = new Set(where?.id?.in ?? []);
      return [{ id: 'fx', path: 'src/middleware.ts' }].filter((r) => ids.has(r.id));
    });

    const context = await retrieveContext(REPO_ID, ['auth'], 'auth flow');

    expect(context.nodes).toHaveLength(1);
    expect(context.nodes[0]).toMatchObject({ name: 'Auth', filePath: 'src/middleware.ts' });
  });
});

describe('hybrid-retriever — edge-type weighting', () => {
  it('skips CONTAINS in relationships but keeps IMPORTS and CALLS', async () => {
    const seed = makeNode('s', 'src/index.ts', 'FILE');
    const dep = makeNode('t', 'src/db.ts', 'FILE');
    const callee = makeNode('u', 'src/utils.ts', 'FILE');

    mock.$queryRaw
      .mockResolvedValueOnce([seed])
      .mockResolvedValueOnce([]);

    const containsEdge = makeEdge('e1', 's', 'x', 'CONTAINS');
    const importEdge = makeEdge('e2', 's', 't', 'IMPORTS');
    const callEdge = makeEdge('e3', 's', 'u', 'CALLS');

    mock.graphEdge.findMany.mockImplementation((args?: { where?: { type?: string } }) => {
      if (args?.where?.type === 'IMPORTS') return Promise.resolve([]); // no hop-2
      return Promise.resolve([containsEdge, importEdge, callEdge]);
    });
    mock.graphNode.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) => {
      const ids = new Set(where?.id?.in ?? []);
      return [dep, callee].filter((n) => ids.has(n.id));
    });

    const context = await retrieveContext(REPO_ID, ['index'], 'what is the index');

    const names = context.nodes.map((n) => n.name);
    expect(names).toContain('src/db.ts');
    expect(names).toContain('src/utils.ts');
    expect(names).not.toContain('getUser');

    const edgeTypes = new Set(context.edges.map((e) => e.type));
    expect(edgeTypes.has('CONTAINS')).toBe(false);
    expect(edgeTypes.has('IMPORTS')).toBe(true);
    expect(edgeTypes.has('CALLS')).toBe(true);
  });

  it('promotes neighbors ranked by weighted connectivity', async () => {
    const s1 = makeNode('s1', 'src/a.ts', 'FILE');
    const s2 = makeNode('s2', 'src/b.ts', 'FILE');
    const strong = makeNode('t', 'src/strong-dep.ts', 'FILE');
    const weak = makeNode('u', 'src/weak-dep.ts', 'FILE');

    mock.$queryRaw
      .mockResolvedValueOnce([s1, s2])
      .mockResolvedValueOnce([]);

    mock.graphEdge.findMany.mockImplementation((args?: { where?: { type?: string } }) => {
      if (args?.where?.type === 'IMPORTS') return Promise.resolve([]);
      return Promise.resolve([
        makeEdge('e1', 's1', 't', 'IMPORTS'), // weight 3
        makeEdge('e2', 's2', 'u', 'CALLS'), // weight 2
      ]);
    });
    mock.graphNode.findMany.mockImplementation(async ({ where }: { where: { id?: { in: string[] } } }) => {
      const ids = new Set(where?.id?.in ?? []);
      return [strong, weak].filter((n) => ids.has(n.id));
    });

    const context = await retrieveContext(REPO_ID, ['a', 'b'], 'dependencies');

    const names = context.nodes.map((n) => n.name);
    const strongIdx = names.findIndex((n) => n === 'src/strong-dep.ts');
    const weakIdx = names.findIndex((n) => n === 'src/weak-dep.ts');
    expect(strongIdx).toBeGreaterThan(-1);
    expect(weakIdx).toBeGreaterThan(-1);
    expect(strongIdx).toBeLessThan(weakIdx);
  });

  it('retains relationships between two seed nodes', async () => {
    const s1 = makeNode('s1', 'src/a.ts', 'FILE');
    const s2 = makeNode('s2', 'src/b.ts', 'FILE');

    mock.$queryRaw
      .mockResolvedValueOnce([s1, s2])
      .mockResolvedValueOnce([]);

    const edge = makeEdge('e1', 's1', 's2', 'IMPORTS');
    mock.graphEdge.findMany.mockImplementation((args?: { where?: { type?: string } }) => {
      if (args?.where?.type === 'IMPORTS') return Promise.resolve([]);
      return Promise.resolve([edge]);
    });
    mock.graphNode.findMany.mockResolvedValue([]);

    const context = await retrieveContext(REPO_ID, ['a', 'b'], 'modules');

    expect(context.edges).toHaveLength(1);
    expect(context.edges[0].type).toBe('IMPORTS');
    expect(context.edges[0].source_node_id).toBe('s1');
    expect(context.edges[0].target_node_id).toBe('s2');
  });
});

describe('hybrid-retriever — fallback', () => {
  it('includes README + file paths when retrieval is sparse', async () => {
    mock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mock.graphEdge.findMany.mockResolvedValue([]);
    mock.repository.findUnique.mockResolvedValue({ readme_content: '# Project' });
    mock.file.findMany.mockResolvedValue([{ path: 'src/a.ts' }, { path: 'src/b.ts' }]);

    const context = await retrieveContext(REPO_ID, ['zzz'], 'general overview');

    expect(context.nodes.length).toBeLessThan(5);
    expect(context.readme).toContain('Project');
    expect(context.filePaths).toContain('src/a.ts');
  });
});
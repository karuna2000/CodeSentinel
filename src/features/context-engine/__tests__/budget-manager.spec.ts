import { describe, it, expect } from 'vitest';
import { formatContextString, buildEvidenceIndex } from '../services/budget-manager';
import { RetrievedContext, RetrievedNode } from '../services/hybrid-retriever';
import { GraphNode, GraphEdge } from '@prisma/client';

function makeNode(overrides: Partial<RetrievedNode> = {}): RetrievedNode {
  return {
    id: 'n1',
    repo_id: 'r1',
    file_id: null,
    type: 'FUNCTION',
    name: 'getSession',
    code_snippet: 'const token = request.headers.get("authorization");',
    signature: 'async function getSession(request)',
    documentation: null,
    start_line: 1,
    end_line: 3,
    start_byte: 0,
    end_byte: 60,
    content_hash: 'abc123',
    index_version: 1,
    created_at: new Date(),
    filePath: null,
    ...overrides,
  };
}

describe('budget-manager', () => {
  it('renders signature, line range and source snippet when present', () => {
    const context: RetrievedContext = { nodes: [makeNode()], edges: [] };
    const out = formatContextString(context);
    expect(out).toContain('Signature: async function getSession(request)');
    expect(out).toContain('[lines 1-3]');
    expect(out).toContain('const token = request.headers.get("authorization");');
  });

  it('keeps the no-snippet fallback when snippet is missing', () => {
    const context: RetrievedContext = { nodes: [makeNode({ code_snippet: null })], edges: [] };
    const out = formatContextString(context);
    expect(out).toContain('(No source code snippet available for this node)');
  });

  it('omits line range when lines are unknown', () => {
    const context: RetrievedContext = { nodes: [makeNode({ start_line: null, end_line: null })], edges: [] };
    const out = formatContextString(context);
    expect(out).not.toContain('[lines');
  });

  it('renders edges as source --[TYPE]--> target', () => {
    const target = makeNode({ id: 'n2', name: 'clamp', type: 'FUNCTION' as GraphNode['type'] });
    const edge = {
      id: 'e1',
      repo_id: 'r1',
      source_node_id: 'n1',
      target_node_id: 'n2',
      type: 'CALLS',
      source_line: null,
      source_file: null,
      metadata: null,
      created_at: new Date(),
    } as GraphEdge;
    const context: RetrievedContext = { nodes: [makeNode(), target], edges: [edge] };
    const out = formatContextString(context);
    expect(out).toContain('getSession --[CALLS]--> clamp');
  });

  it('includes source file and line on edges when present', () => {
    const target = makeNode({ id: 'n2', name: 'clamp', type: 'FUNCTION' as GraphNode['type'] });
    const edge = {
      id: 'e1',
      repo_id: 'r1',
      source_node_id: 'n1',
      target_node_id: 'n2',
      type: 'CALLS',
      source_line: 42,
      source_file: 'src/utils.ts',
      metadata: { expression: 'clamp(value)' },
      created_at: new Date(),
    } as GraphEdge;
    const context: RetrievedContext = { nodes: [makeNode(), target], edges: [edge] };
    const out = formatContextString(context);
    expect(out).toContain('getSession --[CALLS]--> clamp [src/utils.ts:42]');
  });
});

describe('budget-manager — evidence index', () => {
  it('builds ordered E1..En evidence refs with file path and lines', () => {
    const node = makeNode({
      name: 'getUser',
      filePath: 'src/auth.ts',
      start_line: 10,
      end_line: 22,
    });
    const evidence = buildEvidenceIndex([node, makeNode({ id: 'n2', name: 'lib/db.ts', type: 'FILE' as GraphNode['type'], filePath: 'lib/db.ts' })]);
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({ id: 'E1', nodeName: 'getUser', filePath: 'src/auth.ts', startLine: 10, endLine: 22 });
    expect(evidence[1].id).toBe('E2');
  });

  it('renders the EVIDENCE INDEX and tags node headers with [E*]', () => {
    const node = makeNode({
      name: 'getUser',
      filePath: 'src/auth.ts',
      start_line: 10,
      end_line: 22,
    });
    const context: RetrievedContext = { nodes: [node], edges: [] };
    const out = formatContextString(context);
    expect(out).toContain('=== EVIDENCE INDEX ===');
    expect(out).toContain('[E1] getUser (src/auth.ts:10-22)');
    expect(out).toContain('--- [E1] getUser (FUNCTION) [lines 10-22] ---');
  });

  it('renders FILE entries in the evidence index', () => {
    const fileNode = makeNode({ id: 'n2', name: 'src/lib/db.ts', type: 'FILE' as GraphNode['type'], filePath: 'src/lib/db.ts', start_line: null, end_line: null });
    const context: RetrievedContext = { nodes: [fileNode], edges: [] };
    const out = formatContextString(context);
    expect(out).toContain('[E1] src/lib/db.ts (FILE)');
  });
});
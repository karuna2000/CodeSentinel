import { describe, it, expect } from 'vitest';
import { buildInvestigationPlan } from '../agent/build-investigation-plan';
import { classifyByHints } from '../agent/classify-intent';
import { GraphEdgeType } from '@prisma/client';

describe('buildInvestigationPlan — spec §17 table', () => {
  it('locate → light both-direction traversal, smaller result limit', () => {
    const plan = buildInvestigationPlan('locate');
    expect(plan.graph.direction).toBe('both');
    expect(plan.graph.maxHops).toBe(1);
    expect(plan.graph.relations).toEqual([GraphEdgeType.IMPORTS, GraphEdgeType.CALLS]);
    expect(plan.resultLimit).toBe(15);
  });

  it('trace_flow → both-direction deep traversal over execution edges', () => {
    const plan = buildInvestigationPlan('trace_flow');
    expect(plan.graph.direction).toBe('both');
    expect(plan.graph.maxHops).toBe(2);
    expect(plan.graph.relations).toEqual([
      GraphEdgeType.IMPORTS,
      GraphEdgeType.CALLS,
      GraphEdgeType.FETCHES_ROUTE,
      GraphEdgeType.READS_STORE,
      GraphEdgeType.INHERITS,
    ]);
  });

  it('impact → incoming 2-hop traversal (callers/importers)', () => {
    const plan = buildInvestigationPlan('impact');
    expect(plan.graph.direction).toBe('incoming');
    expect(plan.graph.maxHops).toBe(2);
  });

  it('dependency honors an explicit direction hint but defaults to incoming', () => {
    expect(buildInvestigationPlan('dependency').graph.direction).toBe('incoming');
    expect(buildInvestigationPlan('dependency', 'outgoing').graph.direction).toBe('outgoing');
  });

  it('architecture → imports + calls, slightly larger limit', () => {
    const plan = buildInvestigationPlan('architecture');
    expect(plan.graph.relations).toEqual([GraphEdgeType.IMPORTS, GraphEdgeType.CALLS]);
    expect(plan.resultLimit).toBe(24);
  });

  it('debug → single hop around the failing site', () => {
    const plan = buildInvestigationPlan('debug');
    expect(plan.graph.maxHops).toBe(1);
    expect(plan.graph.relations).toContain(GraphEdgeType.CALLS);
  });

  it('every intent produces a valid, retrieval-enabled plan', () => {
    for (const intent of ['locate', 'explain', 'trace_flow', 'architecture', 'dependency', 'impact', 'debug', 'compare'] as const) {
      const plan = buildInvestigationPlan(intent);
      expect(plan.intent).toBe(intent);
      expect(plan.lexicalSearch).toBe(true);
      expect(plan.graph.enabled).toBe(true);
      expect(plan.resultLimit).toBeGreaterThan(0);
    }
  });
});

describe('classifyByHints — deterministic §16 classification', () => {
  it.each([
    ['Where is the rate limiting implemented?', 'locate', undefined],
    ['What does retrieveContext() do?', 'explain', undefined],
    ['How does authentication work end to end?', 'trace_flow', 'both'],
    ['How does wiki generation work?', 'trace_flow', 'both'],
    ['Architecture: how is the repo structured?', 'architecture', undefined],
    ['What could break if I change verifyJWT?', 'impact', 'incoming'],
    ['What depends on this module?', 'impact', 'incoming'],
    ['What calls resolveImportPath?', 'dependency', 'incoming'],
    ['What does rateLimiter depend on?', 'dependency', 'outgoing'],
    ['Why does this request return 401?', 'debug', undefined],
    ['Why is indexing failing?', 'debug', undefined],
    ['Difference between JWT and session auth?', 'compare', undefined],
  ])('%s → %s', (query, expected, direction) => {
    const result = classifyByHints(query);
    expect(result).not.toBeNull();
    expect(result?.intent).toBe(expected);
    expect(result?.confident).toBe(true);
    if (direction) {
      expect(result?.directionHint).toBe(direction);
    }
  });

  it('returns null for genuinely ambiguous queries (model fallback path)', () => {
    expect(classifyByHints('Tell me more about the codebase')).toBeNull();
  });
});
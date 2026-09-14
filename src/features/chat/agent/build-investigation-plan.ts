import { GraphEdgeType } from '@prisma/client';
import type { ChatIntent, GraphDirection, InvestigationPlan } from './types';

/**
 * Maps an intent to an explicit investigation plan (§17). The plan drives the
 * hybrid retriever: which searches run, whether graph traversal is enabled, in
 * which direction, how many hops, and which edge relations participate.
 */
export function buildInvestigationPlan(intent: ChatIntent, directionHint?: GraphDirection): InvestigationPlan {
  const base: InvestigationPlan = {
    intent,
    lexicalSearch: true,
    semanticSearch: true,
    graph: {
      enabled: true,
      direction: 'both',
      maxHops: 1,
      relations: null,
    },
    includeCode: true,
    includeTests: false,
    resultLimit: 20,
  };

  switch (intent) {
    case 'locate':
      // Light traversal — the goal is to find the site, not explain a system.
      base.graph = { enabled: true, direction: 'both', maxHops: 1, relations: [GraphEdgeType.IMPORTS, GraphEdgeType.CALLS] };
      base.resultLimit = 15;
      return base;

    case 'explain': {
      // Direct dependencies + callers, but avoid deep traversal.
      base.graph = { enabled: true, direction: 'both', maxHops: 1, relations: [GraphEdgeType.IMPORTS, GraphEdgeType.CALLS] };
      base.resultLimit = 15;
      return base;
    }

    case 'trace_flow':
      // Execution path — traversal matters more than raw similarity.
      base.graph = {
        enabled: true,
        direction: 'both',
        maxHops: 2,
        relations: [
          GraphEdgeType.IMPORTS,
          GraphEdgeType.CALLS,
          GraphEdgeType.FETCHES_ROUTE,
          GraphEdgeType.READS_STORE,
          GraphEdgeType.INHERITS,
        ],
      };
      base.resultLimit = 20;
      return base;

    case 'architecture':
      // Structure — imports and module boundaries.
      base.graph = { enabled: true, direction: 'both', maxHops: 1, relations: [GraphEdgeType.IMPORTS, GraphEdgeType.CALLS] };
      base.resultLimit = 24;
      return base;

    case 'dependency':
      // Incoming = callers/importers; outgoing = callees/imports.
      base.graph = {
        enabled: true,
        direction: directionHint ?? 'incoming',
        maxHops: 2,
        relations: [
          GraphEdgeType.IMPORTS,
          GraphEdgeType.CALLS,
          GraphEdgeType.INHERITS,
          GraphEdgeType.READS_STORE,
          GraphEdgeType.FETCHES_ROUTE,
        ],
      };
      base.resultLimit = 24;
      return base;

    case 'impact':
      // Reverse traversal: who calls/imports/reads this symbol.
      base.graph = {
        enabled: true,
        direction: 'incoming',
        maxHops: 2,
        relations: [
          GraphEdgeType.IMPORTS,
          GraphEdgeType.CALLS,
          GraphEdgeType.INHERITS,
          GraphEdgeType.READS_STORE,
          GraphEdgeType.FETCHES_ROUTE,
        ],
      };
      base.resultLimit = 24;
      return base;

    case 'debug':
      // Guards/branches are local — one hop around the failing site.
      base.graph = { enabled: true, direction: 'both', maxHops: 1, relations: [GraphEdgeType.CALLS, GraphEdgeType.IMPORTS] };
      base.resultLimit = 15;
      return base;

    case 'compare':
      base.graph = { enabled: true, direction: 'both', maxHops: 1, relations: null };
      base.resultLimit = 20;
      return base;

    default:
      return base;
  }
}
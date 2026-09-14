import type { GraphEdgeType } from '@prisma/client';

/**
 * The eight primary repository-investigation intents (§7). Every query is
 * classified into one of these so the agent can pick the right retrieval and
 * graph-traversal strategy instead of answering every question the same way.
 */
export type ChatIntent =
  | 'locate'
  | 'explain'
  | 'trace_flow'
  | 'architecture'
  | 'dependency'
  | 'impact'
  | 'debug'
  | 'compare';

/** Direction-sensitive graph traversal config (§14, §17). */
export type GraphDirection = 'incoming' | 'outgoing' | 'both';

/**
 * The internal execution plan the agent derives from the intent (§17).
 * `relations` filters which edge types participate in traversal (null = all
 * meaningful types). This is consumed by the hybrid retriever.
 */
export interface InvestigationPlan {
  intent: ChatIntent;
  lexicalSearch: boolean;
  semanticSearch: boolean;
  graph: {
    enabled: boolean;
    direction: GraphDirection;
    maxHops: number;
    relations: GraphEdgeType[] | null;
  };
  includeCode: boolean;
  includeTests: boolean;
  resultLimit: number;
}

/** Answer grounding state (§23, §24). */
export type AnswerStatus = 'grounded' | 'limited_evidence' | 'not_found';

export interface ClassifiedIntent {
  intent: ChatIntent;
  /** Keywords to seed lexical + semantic retrieval. */
  searchTerms: string[];
  /** Preferred traversal direction (dependency/impact queries). */
  directionHint?: GraphDirection;
  /** Whether the classifier was confident or fell back to a default. */
  confident: boolean;
}

/** Retrieval metrics surfaced in the response header and logs (§49). */
export interface RetrievalStats {
  lexicalHits: number;
  semanticHits: number;
  graphExpanded: number;
  evidenceCount: number;
}
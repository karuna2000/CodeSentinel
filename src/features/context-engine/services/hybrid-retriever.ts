import { db } from '@/lib/db';
import { generateEmbedding } from './embedding-service';
import { GraphNode, GraphEdge } from '@prisma/client';

// A retrieved node plus the source file path it lives in (resolved from
// graph_nodes.file_id → files.path). FILE nodes carry their own path (name).
export type RetrievedNode = GraphNode & { filePath: string | null };

export interface RetrievedContext {
  nodes: RetrievedNode[];
  edges: GraphEdge[];
  readme?: string;
  filePaths?: string[];
}

const RRF_K = 60;
const MAX_KEYWORD = 10;
const MAX_SEMANTIC = 10;
const MAX_SEEDS = 15;
const MAX_NEIGHBORS = 8;
const MAX_TOTAL_NODES = 20;
const HOP2_WEIGHT_THRESHOLD = 2; // only expand strong hop-1 neighbors

// Edge-type weights for graph traversal. CONTAINS is implicit (node.file_id
// already encodes containment) so it is excluded from both scoring and the
// relationships returned to the LLM context.
const EDGE_TYPE_WEIGHTS: Record<string, number> = {
  IMPORTS: 3,
  CALLS: 2,
  READS_STORE: 2,
  FETCHES_ROUTE: 1,
};

/** Reciprocal Rank Fusion: 1 / (k + 1-based rank). */
function rrf(rank: number): number {
  return 1 / (RRF_K + rank);
}

export async function retrieveContext(
  repoId: string,
  searchTerms: string[],
  query: string
): Promise<RetrievedContext> {
  const nodesById = new Map<string, GraphNode>();
  const fusedScores = new Map<string, number>();

  // ── 1. Keyword / Lexical Search (weighted Postgres FTS + identifier substring) ─
  if (searchTerms.length > 0) {
    const termQuery = searchTerms.join(' | ');
    // Postgres's `simple` dictionary treats camelCase/PascalCase identifiers as
    // single lexemes ("AsyncClient" → "asyncclient"), so FTS alone misses symbol
    // names for common terms like "client" or "db". Add substring containment on
    // name/signature so identifier fragments are retrievable (ranked below full
    // lexeme matches via NULLS LAST).
    const likePatterns = searchTerms.map((t) => `%${t.toLowerCase()}%`);
    const rankedKeyword = await db.$queryRaw<GraphNode[]>`
      SELECT id, repo_id, file_id, type, name, code_snippet, signature, documentation,
             start_line, end_line, start_byte, end_byte, content_hash, created_at,
             ts_rank_cd(
               setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
               setweight(to_tsvector('simple', coalesce(signature, '')), 'A') ||
               setweight(to_tsvector('english', coalesce(documentation, '')), 'B') ||
               setweight(to_tsvector('simple', coalesce(code_snippet, '')), 'C'),
               websearch_to_tsquery('simple', ${termQuery})
             ) AS rank
      FROM graph_nodes
      WHERE repo_id = ${repoId}
      AND (
        to_tsvector('simple', coalesce(name, '')) @@ websearch_to_tsquery('simple', ${termQuery})
        OR to_tsvector('simple', coalesce(signature, '')) @@ websearch_to_tsquery('simple', ${termQuery})
        OR to_tsvector('english', coalesce(documentation, '')) @@ websearch_to_tsquery('simple', ${termQuery})
        OR to_tsvector('simple', coalesce(code_snippet, '')) @@ websearch_to_tsquery('simple', ${termQuery})
        OR lower(name) LIKE ANY (${likePatterns})
        OR lower(signature) LIKE ANY (${likePatterns})
      )
      ORDER BY rank DESC NULLS LAST
      LIMIT ${MAX_KEYWORD}
    `;

    rankedKeyword.forEach((node, idx) => {
      nodesById.set(node.id, node);
      fusedScores.set(node.id, (fusedScores.get(node.id) ?? 0) + rrf(idx + 1));
    });
  }

  // ── 2. Semantic Search (pgvector cosine) ──────────────────────────────
  try {
    const embedding = await generateEmbedding(query);
    const embeddingString = `[${embedding.join(',')}]`;

    const rankedSemantic = await db.$queryRaw<GraphNode[]>`
      SELECT id, repo_id, file_id, type, name, code_snippet, signature, documentation,
             start_line, end_line, start_byte, end_byte, content_hash, created_at
      FROM graph_nodes
      WHERE repo_id = ${repoId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingString}::vector
      LIMIT ${MAX_SEMANTIC}
    `;

    rankedSemantic.forEach((node, idx) => {
      nodesById.set(node.id, node);
      fusedScores.set(node.id, (fusedScores.get(node.id) ?? 0) + rrf(idx + 1));
    });
  } catch (err) {
    console.error('Semantic search failed:', err);
  }

  // ── 3. Rank by fused score → seed candidates for traversal ────────────
  const scoredCandidates = Array.from(fusedScores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SEEDS);
  const seedIds = new Set(scoredCandidates.map((c) => c.id));
  const knownIds = new Set(fusedScores.keys()); // already ranked — never traverse into these

  // ── 4. Graph traversal with edge-type weighting ───────────────────────
  // Hop 1: all meaningful edge types from seed nodes.
  // Hop 2: IMPORTS-only expansion from strong neighbors (decayed).
  const traversalScores = new Map<string, number>();
  const neighborIds = new Set<string>();
  const visitedEdges = new Map<string, GraphEdge>();

  const recordEdge = (edge: GraphEdge) => {
    if ((EDGE_TYPE_WEIGHTS[edge.type] ?? 0) > 0 && !visitedEdges.has(edge.id)) {
      visitedEdges.set(edge.id, edge);
    }
  };

  const scoreNeighbor = (id: string, weight: number) => {
    if (knownIds.has(id) || seedIds.has(id)) return;
    traversalScores.set(id, (traversalScores.get(id) ?? 0) + weight);
    neighborIds.add(id);
  };

  if (seedIds.size > 0) {
    const seedArr = Array.from(seedIds);
    const hop1Edges = await db.graphEdge.findMany({
      where: {
        repo_id: repoId,
        OR: [{ source_node_id: { in: seedArr } }, { target_node_id: { in: seedArr } }],
      },
    });

    const hop1Strong = new Set<string>();
    for (const edge of hop1Edges) {
      const weight = EDGE_TYPE_WEIGHTS[edge.type] ?? 0;
      if (weight === 0) continue;
      recordEdge(edge);

      if (seedIds.has(edge.source_node_id)) {
        scoreNeighbor(edge.target_node_id, weight);
        if (weight >= HOP2_WEIGHT_THRESHOLD) hop1Strong.add(edge.target_node_id);
      }
      if (seedIds.has(edge.target_node_id)) {
        scoreNeighbor(edge.source_node_id, weight);
        if (weight >= HOP2_WEIGHT_THRESHOLD) hop1Strong.add(edge.source_node_id);
      }
    }

    if (hop1Strong.size > 0) {
      const hop2Edges = await db.graphEdge.findMany({
        where: {
          repo_id: repoId,
          type: 'IMPORTS',
          OR: [
            { source_node_id: { in: Array.from(hop1Strong) } },
            { target_node_id: { in: Array.from(hop1Strong) } },
          ],
        },
      });

      for (const edge of hop2Edges) {
        const weight = EDGE_TYPE_WEIGHTS.IMPORTS * 0.5;
        if (hop1Strong.has(edge.source_node_id)) {
          recordEdge(edge);
          scoreNeighbor(edge.target_node_id, weight);
        }
        if (hop1Strong.has(edge.target_node_id)) {
          recordEdge(edge);
          scoreNeighbor(edge.source_node_id, weight);
        }
      }
    }

    // Fetch traversal-discovered neighbor rows once, then filter which
    // recorded relationships actually link nodes that made the final list.
    if (neighborIds.size > 0) {
      const rows = await db.graphNode.findMany({
        where: { id: { in: Array.from(neighborIds) } },
      });
      for (const node of rows) nodesById.set(node.id, node);
    }
  }

  // ── 5. Assemble final ranked node list ────────────────────────────────
  const primaryNodes = scoredCandidates
    .map((c) => nodesById.get(c.id))
    .filter((n): n is GraphNode => Boolean(n))
    .slice(0, MAX_TOTAL_NODES);

  const promotedNeighbors = Array.from(traversalScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_NEIGHBORS)
    .map(([id]) => nodesById.get(id))
    .filter((n): n is GraphNode => Boolean(n));

  const finalNodes: RetrievedNode[] = [
    ...primaryNodes,
    ...promotedNeighbors,
  ].slice(0, MAX_TOTAL_NODES) as RetrievedNode[];

  // Resolve each node's source file (for grounded evidence citations).
  if (finalNodes.length > 0) {
    const fileIds = Array.from(
      new Set(finalNodes.map((n) => n.file_id).filter((x): x is string => Boolean(x)))
    );
    if (fileIds.length > 0) {
      const files = await db.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, path: true },
      });
      const pathById = new Map(files.map((f) => [f.id, f.path]));
      for (const node of finalNodes) {
        const retrievedNode = node as RetrievedNode;
        retrievedNode.filePath = node.file_id ? (pathById.get(node.file_id) ?? null) : null;
      }
    } else {
      for (const node of finalNodes) (node as RetrievedNode).filePath = null;
    }
  }

  const finalNodeIds = new Set(finalNodes.map((n) => n.id));

  const finalEdges = Array.from(visitedEdges.values()).filter(
    (e) => finalNodeIds.has(e.source_node_id) && finalNodeIds.has(e.target_node_id)
  );

  const result: RetrievedContext = {
    nodes: finalNodes,
    edges: finalEdges,
  };

  // ── 6. README + file-tree fallback — for broad/project-level queries and
  //        as a safety net when the graph has no data yet.
  if (result.nodes.length < 5) {
    try {
      const repo = await db.repository.findUnique({
        where: { id: repoId },
        select: { readme_content: true },
      });
      if (repo?.readme_content) {
        result.readme = repo.readme_content.slice(0, 4000);
      }

      const files = await db.file.findMany({
        where: { repo_id: repoId },
        select: { path: true },
        orderBy: { path: 'asc' },
        take: 100,
      });
      if (files.length > 0) {
        result.filePaths = files.map((f: { path: string }) => f.path);
      }
    } catch (e) {
      console.error('README/file fallback failed:', e);
    }
  }

  return result;
}
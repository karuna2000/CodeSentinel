import { db } from '@/lib/db';

interface GraphEdgeWithNodes {
  source_node: { name: string; type: string };
  target_node: { name: string; type: string };
}

/**
 * Converts node/edge data into a Mermaid flowchart DSL string.
 * Groups files into subgraphs by top-level folder.
 */
function buildFlowchartDSL(edges: GraphEdgeWithNodes[]): string {
  const lines: string[] = ['flowchart LR'];

  // Collect unique folders from edge endpoints
  const folders = new Set<string>();
  const nodeFolder = (name: string) => {
    const parts = name.split('/');
    return parts.slice(0, Math.min(3, parts.length - 1)).join('/') || 'root';
  };

  const processedEdges: Array<[string, string]> = [];

  for (const edge of edges) {
    const src = edge.source_node.name;
    const tgt = edge.target_node.name;
    // Avoid self-references and external (non-project) imports
    if (src === tgt) continue;
    if (!tgt.startsWith('src/') && !tgt.startsWith('app/')) continue;

    const srcFolder = nodeFolder(src);
    const tgtFolder = nodeFolder(tgt);
    if (srcFolder !== tgtFolder) {
      processedEdges.push([srcFolder, tgtFolder]);
      folders.add(srcFolder);
      folders.add(tgtFolder);
    }
  }

  // Deduplicate edges
  const uniqueEdges = Array.from(
    new Set(processedEdges.map(([a, b]) => `${a}__ARROW__${b}`))
  ).map(e => e.split('__ARROW__') as [string, string]);

  // Sanitize IDs for Mermaid (replace slashes and dots with underscores)
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');

  // Emit folder nodes with labels
  for (const folder of folders) {
    const label = folder.split('/').pop() || folder;
    lines.push(`  ${sanitize(folder)}["📁 ${label}"]`);
  }

  // Emit edges
  for (const [src, tgt] of uniqueEdges) {
    lines.push(`  ${sanitize(src)} --> ${sanitize(tgt)}`);
  }

  return lines.join('\n');
}

/**
 * Generates a whole-repo flowchart Mermaid diagram from IMPORTS edges,
 * upserts into the diagrams table.
 */
export async function generateFlowchart(repoId: string): Promise<string> {
  // Fetch import edges with both endpoint names
  const edges = await db.graphEdge.findMany({
    where: { repo_id: repoId, type: 'IMPORTS' },
    select: {
      source_node: { select: { name: true, type: true } },
      target_node: { select: { name: true, type: true } },
    },
    take: 500, // cap to avoid enormous diagrams
  });

  const mermaidSrc = buildFlowchartDSL(edges as GraphEdgeWithNodes[]);

  const repo = await db.repository.findUnique({
    where: { id: repoId },
    select: { commit_sha: true },
  });
  const commitSha = repo?.commit_sha ?? null;

  // Upsert into diagrams table (one flowchart per repo at path = null)
  const existing = await db.diagram.findFirst({
    where: { repo_id: repoId, type: 'FLOWCHART', path: null },
  });

  if (existing) {
    await db.diagram.update({
      where: { id: existing.id },
      data: { mermaid_src: mermaidSrc, commit_sha: commitSha, updated_at: new Date() },
    });
  } else {
    await db.diagram.create({
      data: { repo_id: repoId, type: 'FLOWCHART', path: null, mermaid_src: mermaidSrc, commit_sha: commitSha },
    });
  }

  return mermaidSrc;
}

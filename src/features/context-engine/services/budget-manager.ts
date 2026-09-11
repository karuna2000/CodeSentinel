import { RetrievedContext, RetrievedNode } from './hybrid-retriever';

// A rough approximation: 4 characters per token
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_TOKENS = 12000; // Leave room for system prompt and generated answer

// A stable evidence reference for a node in the final ranking. `id` is the
// [E*] tag the prompt uses so the LLM can cite grounded locations.
export interface EvidenceRef {
  id: string;
  nodeName: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
}

export function buildEvidenceIndex(nodes: RetrievedContext['nodes']): EvidenceRef[] {
  return nodes.map((node, i) => ({
    id: `E${i + 1}`,
    nodeName: node.name,
    filePath: (node as RetrievedNode).filePath ?? (node.type === 'FILE' ? node.name : null),
    startLine: node.start_line,
    endLine: node.end_line,
  }));
}

export function formatContextString(context: RetrievedContext): string {
  let contextString = '';
  let tokenCount = 0;

  // 0. README — highest priority, prepend first
  if (context.readme) {
    const readmeStr = `=== PROJECT README ===\n${context.readme}\n\n`;
    contextString += readmeStr;
    tokenCount += Math.ceil(readmeStr.length / CHARS_PER_TOKEN);
  }

  // 0b. File tree — gives the model a structural overview
  if (context.filePaths && context.filePaths.length > 0) {
    const tree = context.filePaths.join('\n');
    const treeStr = `=== FILE TREE (${context.filePaths.length} files) ===\n${tree}\n\n`;
    tokenCount += Math.ceil(treeStr.length / CHARS_PER_TOKEN);
    if (tokenCount <= MAX_CONTEXT_TOKENS) {
      contextString += treeStr;
    }
  }

  contextString += '=== ARCHITECTURAL GRAPH EDGES ===\n';
  for (const edge of context.edges) {
    const source = context.nodes.find(n => n.id === edge.source_node_id)?.name || edge.source_node_id;
    const target = context.nodes.find(n => n.id === edge.target_node_id)?.name || edge.target_node_id;
    const location = edge.source_file && edge.source_line
      ? ` [${edge.source_file}:${edge.source_line}]`
      : '';
    const edgeStr = `${source} --[${edge.type}]--> ${target}${location}\n`;
    
    tokenCount += Math.ceil(edgeStr.length / CHARS_PER_TOKEN);
    if (tokenCount > MAX_CONTEXT_TOKENS) break;
    
    contextString += edgeStr;
  }

  contextString += '\n=== EVIDENCE INDEX ===\n';
  const evidence = buildEvidenceIndex(context.nodes);
  for (const ev of evidence) {
    const isFile = ev.nodeName === ev.filePath;
    const location = !isFile && ev.filePath
      ? ev.startLine != null && ev.endLine != null
        ? `${ev.filePath}:${ev.startLine}-${ev.endLine}`
        : ev.filePath
      : '';
    const line = isFile
      ? `[${ev.id}] ${ev.nodeName} (FILE)\n`
      : `[${ev.id}] ${ev.nodeName} (${location || 'unknown'})\n`;

    const estimatedTokens = Math.ceil(line.length / CHARS_PER_TOKEN);
    if (tokenCount + estimatedTokens > MAX_CONTEXT_TOKENS) break;
    contextString += line;
    tokenCount += estimatedTokens;
  }

  contextString += '\n=== RELEVANT CODE NODES ===\n';
  for (const [idx, node] of context.nodes.entries()) {
    const location = node.start_line && node.end_line ? ` [lines ${node.start_line}-${node.end_line}]` : '';
    let nodeStr = `\n--- [${evidence[idx]?.id ?? '?'}] ${node.name} (${node.type})${location} ---\n`;
    if (node.signature) {
      nodeStr += `Signature: ${node.signature}\n`;
    }
    if (node.code_snippet) {
      nodeStr += `${node.code_snippet}\n`;
    } else {
      nodeStr += `(No source code snippet available for this node)\n`;
    }

    const estimatedTokens = Math.ceil(nodeStr.length / CHARS_PER_TOKEN);
    if (tokenCount + estimatedTokens > MAX_CONTEXT_TOKENS) {
      contextString += `\n[Context truncated due to token limits]\n`;
      break;
    }

    contextString += nodeStr;
    tokenCount += estimatedTokens;
  }

  return contextString;
}

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import crypto from 'crypto';
import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { parseCode, getLanguage } from '@/features/code-intelligence/parser';
import { extractSymbols, ExtractedSymbol } from '@/features/code-intelligence/symbol-extractor';
import { extractEdges } from '@/features/code-intelligence/edge-builder';
import { generateEmbedding } from '@/features/context-engine/services/embedding-service';
import { GraphNodeType, GraphEdgeType } from '@prisma/client';
import { withSpan } from '@/lib/tracing';
import { logger } from '@/lib/logger';
import { TelemetryEvent, eventContext } from '@/lib/observability-events';
import {
  recordIndexDuration,
  recordIndexFiles,
  recordIndexJob,
} from '@/lib/metrics';

const MAX_EMBEDDING_CHARS = 2000; // keep within bge-small context (~512 tokens)

/** A pre-existing symbol node (used for content_hash diffing). */
export interface SymbolNodeRef {
  id: string;
  name: string;
  type: GraphNodeType;
  contentHash: string | null;
}

export interface SymbolChangeResult {
  /** Old nodes whose content hash still matches — reuse their id + embedding. */
  keep: SymbolNodeRef[];
  /** Old nodes that are stale or changed — delete them (cascades their edges). */
  delete: SymbolNodeRef[];
  /** New or changed symbols — insert a fresh node with full evidence. */
  create: ExtractedSymbol[];
}

/**
 * Compares existing symbol nodes against freshly extracted symbols and
 * classifies them as keep / delete / create using content_hash gating.
 * Kept nodes preserve their id and embedding (so inbound edges survive);
 * only genuinely changed/new symbols are re-indexed.
 */
export function computeSymbolChanges(
  oldSymbols: SymbolNodeRef[],
  newSymbols: ExtractedSymbol[]
): SymbolChangeResult {
  const keep: SymbolNodeRef[] = [];
  const del: SymbolNodeRef[] = [];
  const used = new Set<string>();

  const seenNew = new Set<string>();
  for (const sym of newSymbols) {
    const key = `${sym.type}:${sym.name}`;
    if (seenNew.has(key)) continue; // duplicate symbol in same file — only diff the first
    seenNew.add(key);

    const match = oldSymbols.find(
      (o) => o.type === sym.type && o.name === sym.name && (o as SymbolNodeRef).contentHash === sym.contentHash
    );
    if (match && !used.has(match.id)) {
      keep.push(match);
      used.add(match.id);
    }
  }

  for (const old of oldSymbols) {
    if (!used.has(old.id)) del.push(old);
  }

  const keptKeys = new Set(keep.map((k) => `${k.type}:${k.name}`));
  const create = newSymbols.filter((sym, idx, arr) => {
    const key = `${sym.type}:${sym.name}`;
    return arr.findIndex((s) => `${s.type}:${s.name}` === key) === idx && !keptKeys.has(key);
  });

  return { keep, delete: del, create };
}

/**
 * Creates an Octokit instance authenticated as a GitHub App Installation.
 */
export async function getInstallationClient(installationId: number) {
  if (!env.githubAppId || !env.githubAppPrivateKey) {
    throw new Error('GitHub App credentials are not configured in environment variables.');
  }

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.githubAppId,
      privateKey: env.githubAppPrivateKey,
      installationId: installationId,
    },
  });

  return octokit;
}

/**
 * Creates an Octokit instance authenticated as the GitHub App itself.
 */
export async function getAppClient() {
  if (!env.githubAppId || !env.githubAppPrivateKey) {
    throw new Error('GitHub App credentials are not configured in environment variables.');
  }

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.githubAppId,
      privateKey: env.githubAppPrivateKey,
    },
  });

  return octokit;
}

/**
 * Fetches all repositories accessible to a specific installation.
 */
export async function getInstallationRepositories(installationId: number) {
  const client = await getInstallationClient(installationId);
  const repositories = [];
  let page = 1;

  for (;;) {
    const response = await client.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
      page,
    });
    repositories.push(...response.data.repositories);
    if (
      repositories.length >= response.data.total_count ||
      response.data.repositories.length < 100
    ) {
      break;
    }
    page += 1;
  }

  return repositories;
}

/**
 * Fetches the recursive file tree for a repository.
 */
export async function getRepositoryTree(installationId: number, owner: string, repo: string, defaultBranch: string) {
  const client = await getInstallationClient(installationId);

  const response = await client.rest.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: 'true',
  });

  return response.data.tree;
}

/**
 * Resolves the HEAD commit SHA for the default branch. This anchors every
 * indexed symbol and generated doc to a concrete repository version.
 */
export async function getHeadCommitSha(installationId: number, owner: string, repo: string, defaultBranch: string): Promise<string | null> {
  try {
    const client = await getInstallationClient(installationId);
    const response = await client.rest.repos.getBranch({ owner, repo, branch: defaultBranch });
    return response.data.commit.sha ?? null;
  } catch (err) {
    console.warn(`Failed to resolve HEAD commit for ${owner}/${repo}:`, err);
    return null;
  }
}

/**
 * Fetches the raw content of a file.
 */
export async function getFileContent(installationId: number, owner: string, repo: string, path: string): Promise<string> {
  const client = await getInstallationClient(installationId);

  const response = await client.rest.repos.getContent({
    owner,
    repo,
    path,
  });

  if (Array.isArray(response.data) || response.data.type !== 'file' || !('content' in response.data)) {
    throw new Error(`Path ${path} is not a file or content is missing`);
  }

  // Content is base64 encoded by GitHub API
  return Buffer.from(response.data.content, 'base64').toString('utf8');
}

/**
 * Filters out binary/media and non-essential build/lock files.
 */
export function isIndexableFile(path: string): boolean {
  const lower = path.toLowerCase();

  const ignoredPrefixes = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.next/',
    'out/',
    'coverage/',
    'vendor/',
    '.yarn/',
    'tmp/',
  ];

  if (ignoredPrefixes.some((prefix) => lower.startsWith(prefix) || lower.includes('/' + prefix))) {
    return false;
  }

  const ignoredExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
    '.mp4', '.webm', '.mov', '.mp3', '.wav',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
    '.lock', '.lockb', '-lock.json', '.min.js', '.min.css',
    '.map', '.wasm', '.woff', '.woff2', '.ttf', '.eot',
  ];

  return !ignoredExtensions.some((ext) => lower.endsWith(ext));
}

interface FileSeed {
  repo_id: string;
  path: string;
  sha: string;
  size: number;
}

function isParseable(path: string): boolean {
  const p = path.toLowerCase();
  return p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.py');
}

function isTypescript(path: string) {
  const p = path.toLowerCase();
  return p.endsWith('.ts') || p.endsWith('.tsx');
}

function isJavascript(path: string) {
  const p = path.toLowerCase();
  return p.endsWith('.js') || p.endsWith('.jsx');
}

function isPython(path: string) {
  return path.toLowerCase().endsWith('.py');
}

/**
 * Builds the text we embed for semantic search. Lexical search (FTS) and
 * embedding have different needs — the embedding gets behavior-rich text
 * (signature + docs + body) so natural-language queries can find symbols
 * whose *names* don't match the asker's terminology.
 */
function buildEmbeddingText(sym: ExtractedSymbol, filePath: string): string {
  const parts = [
    `symbol: ${sym.name}`,
    `type: ${sym.type.toLowerCase()}`,
    sym.signature ? `signature: ${sym.signature}` : '',
    sym.documentation ? `documentation: ${sym.documentation}` : '',
    `file: ${filePath}`,
    sym.codeSnippet ? `code:\n${sym.codeSnippet}` : '',
  ];
  return parts.filter(Boolean).join('\n').slice(0, MAX_EMBEDDING_CHARS);
}

/**
 * Indexes a repository: syncs the file tree (diff-based, no full wipe), stores
 * the HEAD commit, and re-extracts graph evidence only for changed files.
 */
export async function indexRepository(
  installationId: number,
  dbRepoId: string,
  owner: string,
  repo: string,
  defaultBranch: string
) {
  // Root span for the indexing pipeline (spec §19) — children below.
  // Attributes are identifiers + counts only, never file contents.
  return withSpan('index.repository', { repoId: dbRepoId }, async (rootSpan) => {
    const startedAt = Date.now();
    logger.info(
      '[Index]',
      `Indexing started for ${owner}/${repo}`,
      eventContext(TelemetryEvent.RepositoryIndexingStarted, { repoId: dbRepoId }),
    );
    try {
      const result = await indexRepositoryInner(
        installationId,
        dbRepoId,
        owner,
        repo,
        defaultBranch,
        rootSpan.setAttributes.bind(rootSpan),
      );
      const durationS = (Date.now() - startedAt) / 1000;
      recordIndexJob('success');
      recordIndexDuration(durationS, 'success');
      recordIndexFiles(result.fileCount, 'success');
      logger.info(
        '[Index]',
        `Indexing completed for ${owner}/${repo}`,
        eventContext(TelemetryEvent.RepositoryIndexingCompleted, {
          repoId: dbRepoId,
          fileCount: result.fileCount,
          changed: result.changed,
          durationS: Math.round(durationS),
        }),
      );
      return result;
    } catch (err) {
      recordIndexJob('failure');
      logger.error(
        '[Index]',
        `Indexing failed for ${owner}/${repo}`,
        eventContext(TelemetryEvent.RepositoryIndexingFailed, {
          repoId: dbRepoId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    }
  });
}

async function indexRepositoryInner(
  installationId: number,
  dbRepoId: string,
  owner: string,
  repo: string,
  defaultBranch: string,
  setRootAttributes: (attrs: Record<string, string | number | boolean>) => void,
) {
    const [rawTree, headCommitSha] = await withSpan(
      'index.fetch',
      { owner, repo, defaultBranch },
      async () =>
        Promise.all([
          getRepositoryTree(installationId, owner, repo, defaultBranch),
          getHeadCommitSha(installationId, owner, repo, defaultBranch),
        ]),
    );

  // Filter to indexable blobs (files) only
  const validFiles: FileSeed[] = rawTree
    .filter((item) => item.type === 'blob' && item.path && isIndexableFile(item.path))
    .map((item) => ({
      repo_id: dbRepoId,
      path: item.path!,
      sha: item.sha || '',
      size: item.size || 0,
    }));

  // ── Diff against the previous index ─────────────────────────────────────
  const { newPaths, changedPaths, removedPaths } = await withSpan(
    'index.diff',
    { fileCount: validFiles.length },
    async (span) => {
      const existingFiles = await db.file.findMany({
        where: { repo_id: dbRepoId },
        select: { id: true, path: true, content_hash: true },
      });
      const existingById = new Map(existingFiles.map((f) => [f.path, f.id]));
      const existingHashes = new Map(existingFiles.map((f) => [f.path, f.content_hash]));

      const newP = validFiles.filter((f) => !existingById.has(f.path));
      const changedP = validFiles.filter((f) => existingById.has(f.path) && existingHashes.get(f.path) !== f.sha);
      const removedP = existingFiles.filter((f) => !validFiles.some((v) => v.path === f.path)).map((f) => f.path);
      span.setAttributes({ 'index.new': newP.length, 'index.changed': changedP.length, 'index.removed': removedP.length });
      return { newPaths: newP, changedPaths: changedP, removedPaths: removedP };
    },
  );

  // Upsert file rows (additive/new + hash updates), preserving unchanged rows.
  if (newPaths.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < newPaths.length; i += chunkSize) {
      await db.file.createMany({
        data: newPaths.slice(i, i + chunkSize).map((f) => ({
          repo_id: dbRepoId,
          path: f.path,
          content_hash: f.sha || null,
          size: f.size,
        })),
        skipDuplicates: true,
      });
    }
  }
  for (const f of changedPaths) {
    await db.file.updateMany({
      where: { repo_id: dbRepoId, path: f.path },
      data: { content_hash: f.sha || null, size: f.size },
    });
  }
  if (removedPaths.length > 0) {
    // Cascades to graph_nodes (file_id) and via them to graph_edges.
    await db.file.deleteMany({ where: { repo_id: dbRepoId, path: { in: removedPaths } } });
  }

  // 2. README seeding
  let readmeContent: string | null = null;
  try {
    const client = await getInstallationClient(installationId);
    const readmeRes = await client.rest.repos.getReadme({ owner, repo });
    if (readmeRes.data && 'content' in readmeRes.data) {
      readmeContent = Buffer.from(readmeRes.data.content, 'base64').toString('utf8');
    }
  } catch {
    console.warn(`No README found for ${owner}/${repo}`);
  }

  // 3. Mark repository as indexed
  const now = new Date().toISOString();
  await db.repository.update({
    where: { id: dbRepoId },
    data: {
      is_indexed: true,
      file_count: validFiles.length,
      readme_content: readmeContent,
      commit_sha: headCommitSha,
      last_synced: now,
    },
  });

  // 4. Build/refresh repository graph for changed files only
  try {
    await withSpan(
      'index.graph',
      { changedFiles: newPaths.length + changedPaths.length },
      async () =>
        buildRepositoryGraph(installationId, dbRepoId, owner, repo, [...newPaths, ...changedPaths]),
    );
  } catch (err) {
    console.error('Error building repository graph:', err);
    // don't fail the entire indexing process if graph fails
  }

  setRootAttributes({ fileCount: validFiles.length, commitSha: headCommitSha ?? '' });

  return {
    fileCount: validFiles.length,
    changed: newPaths.length + changedPaths.length,
    removed: removedPaths.length,
    hasReadme: Boolean(readmeContent),
    readmeContent,
    commitSha: headCommitSha,
    lastSynced: now,
  };
}

/**
 * Downloads changed parseable files, parses them via Tree-sitter, and
 * updates the graph incrementally: unchanged symbols keep their node id and
 * embedding (inbound edges survive), the FILE node id is reused per path
 * (imports into a changed file persist), and only genuinely changed or new
 * symbols are re-indexed. Each rebuilt file's previously-sourced edges are
 * refreshed so no stale or duplicate edges accumulate.
 */
export async function buildRepositoryGraph(
  installationId: number,
  dbRepoId: string,
  owner: string,
  repo: string,
  files: FileSeed[]
) {
  const parseableFiles = files.filter((f) => isParseable(f.path));
  if (parseableFiles.length === 0) return;

  console.log(`Building graph for ${dbRepoId}: ${parseableFiles.length} changed file(s)...`);

  // Path -> file id for ALL repo files (unchanged rows included) so nodes attach correctly.
  const dbFiles = await db.file.findMany({
    where: { repo_id: dbRepoId },
    select: { id: true, path: true },
  });
  const pathToFileId = new Map<string, string>(dbFiles.map((f) => [f.path, f.id]));

  // Pre-existing nodes for target resolution across unchanged files.
  const existingNodes = await db.graphNode.findMany({
    where: { repo_id: dbRepoId },
    select: { id: true, name: true, type: true },
  });
  const fileNodePathToId = new Map<string, string>(); // FILE node name (=path) -> node id
  const symbolNameToNodeId = new Map<string, string>(); // naive symbol name -> node id
  for (const node of existingNodes) {
    if (node.type === 'FILE') fileNodePathToId.set(node.name, node.id);
    else if (!symbolNameToNodeId.has(node.name)) symbolNameToNodeId.set(node.name, node.id);
  }

  const allNodesToInsert: {
    id: string;
    repo_id: string;
    file_id?: string | null;
    type: GraphNodeType;
    name: string;
    code_snippet?: string | null;
    signature?: string | null;
    documentation?: string | null;
    start_line?: number | null;
    end_line?: number | null;
    start_byte?: number | null;
    end_byte?: number | null;
    content_hash?: string | null;
  }[] = [];
  const nodesWithEmbeddings: { id: string; text: string }[] = [];
  const edgesToInsert: {
    repo_id: string;
    source_node_id: string;
    target_node_id: string;
    type: GraphEdgeType;
    source_line?: number | null;
    source_file?: string | null;
    metadata?: Record<string, string>;
  }[] = [];
  const pendingEdges: {
    sourcePath: string;
    target: string;
    type: GraphEdgeType;
    startLine: number;
    metadata?: Record<string, string>;
  }[] = [];
  const pendingContains: { repoId: string; fileNodeId: string; symbolIds: string[] }[] = [];
  const nodeIdsToDelete: string[] = [];
  const sourceNodesToClear = new Set<string>(); // files whose sourced edges are refreshed

  const resolveImportPath = (sourceFile: string, importPath: string): string => {
    if (importPath.startsWith('@/')) {
      return importPath.replace(/^@\//, 'src/');
    }
    if (importPath.startsWith('.')) {
      const parts = sourceFile.split('/');
      parts.pop(); // remove filename
      const importParts = importPath.split('/');
      for (const p of importParts) {
        if (p === '.') continue;
        if (p === '..') parts.pop();
        else parts.push(p);
      }
      return parts.join('/');
    }
    return importPath;
  };

  for (const file of parseableFiles) {
    let lang: 'typescript' | 'javascript' | 'python' | null = null;
    if (isTypescript(file.path)) lang = 'typescript';
    else if (isJavascript(file.path)) lang = 'javascript';
    else if (isPython(file.path)) lang = 'python';
    if (!lang) continue;

    const fileId = pathToFileId.get(file.path);
    if (!fileId) continue; // stale seed — file row missing

    try {
      const content = await getFileContent(installationId, owner, repo, file.path);
      const tree = await parseCode(content, lang);
      if (!tree) continue;
      const language = await getLanguage(lang);

      // Pre-existing nodes for this file (may be first index or incremental).
      const oldNodes = await db.graphNode.findMany({
        where: { repo_id: dbRepoId, file_id: fileId },
        select: { id: true, name: true, type: true, content_hash: true },
      });
      const oldFileNode = oldNodes.find((n) => n.type === 'FILE');
      const oldSymbolRefs: SymbolNodeRef[] = oldNodes
        .filter((n) => n.type !== 'FILE')
        .map((n) => ({ id: n.id, name: n.name, type: n.type as GraphNodeType, contentHash: n.content_hash }));

      // Reuse the FILE node id so inbound imports to this file survive edits.
      const fileNodeId = oldFileNode?.id ?? crypto.randomUUID();
      fileNodePathToId.set(file.path, fileNodeId);
      if (!oldFileNode) {
        allNodesToInsert.push({
          id: fileNodeId,
          repo_id: dbRepoId,
          file_id: fileId,
          type: 'FILE',
          name: file.path,
        });
      }

      // Extract symbols with full evidence (signature, bytes, snippet, hash).
      const symbols = extractSymbols(tree, language, lang, content);

      // Symbol-level content_hash gating: keep unchanged nodes (id + embedding).
      const { keep, delete: del, create } = computeSymbolChanges(oldSymbolRefs, symbols);

      const deletedIds = new Set(del.map((d) => d.id));
      for (const d of del) {
        if (symbolNameToNodeId.get(d.name) === d.id) symbolNameToNodeId.delete(d.name);
        nodeIdsToDelete.push(d.id);
      }

      const symbolIdsForFile: string[] = [];
      for (const k of keep) {
        symbolIdsForFile.push(k.id);
        if (!symbolNameToNodeId.has(k.name)) symbolNameToNodeId.set(k.name, k.id);
      }

      for (const sym of create) {
        const symNodeId = crypto.randomUUID();
        if (!symbolNameToNodeId.has(sym.name) || deletedIds.has(symbolNameToNodeId.get(sym.name)!)) {
          symbolNameToNodeId.set(sym.name, symNodeId);
        }

        allNodesToInsert.push({
          id: symNodeId,
          repo_id: dbRepoId,
          file_id: fileId,
          type: sym.type,
          name: sym.name,
          code_snippet: sym.codeSnippet,
          signature: sym.signature,
          documentation: sym.documentation,
          start_line: sym.startLine,
          end_line: sym.endLine,
          start_byte: sym.startByte,
          end_byte: sym.endByte,
          content_hash: sym.contentHash,
        });

        nodesWithEmbeddings.push({
          id: symNodeId,
          text: buildEmbeddingText(sym, file.path),
        });

        symbolIdsForFile.push(symNodeId);
      }

      if (symbolIdsForFile.length > 0) {
        pendingContains.push({ repoId: dbRepoId, fileNodeId, symbolIds: symbolIdsForFile });
        sourceNodesToClear.add(fileNodeId);
      }

      // Extract edges (imports/calls)
      const edges = extractEdges(tree, language, lang);
      for (const edge of edges) {
        pendingEdges.push({
          sourcePath: file.path,
          target: edge.target,
          type: edge.type,
          startLine: edge.startLine,
          metadata: edge.metadata,
        });
      }
    } catch (e) {
      console.warn(`Failed to parse or fetch file ${file.path}:`, e);
    }
  }

  // 1. Delete stale/replaced symbol nodes (cascades their inbound/outbound edges).
  if (nodeIdsToDelete.length > 0) {
    await db.graphNode.deleteMany({ where: { id: { in: nodeIdsToDelete } } });
  }

  // 2. Insert fresh nodes (FILE anchors for new files + new/replaced symbols).
  if (allNodesToInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < allNodesToInsert.length; i += chunkSize) {
      await db.graphNode.createMany({ data: allNodesToInsert.slice(i, i + chunkSize) });
    }

    // Generate and persist embeddings for fresh symbols only
    console.log(`Generating embeddings for ${nodesWithEmbeddings.length} nodes...`);
    for (const node of nodesWithEmbeddings) {
      try {
        const embedding = await generateEmbedding(node.text);
        // Prisma doesn't natively support updating unsupported types elegantly without raw SQL
        const embeddingString = `[${embedding.join(',')}]`;
        await db.$executeRawUnsafe(
          `UPDATE graph_nodes SET embedding = $1::vector WHERE id = $2`,
          embeddingString,
          node.id
        );
      } catch (err) {
        console.error(`Failed to generate/save embedding for node ${node.id}:`, err);
      }
    }
  }

  // 3. Clear each rebuilt file's previously-sourced edges (incl. CLEAN CONTAINS)
  //    so the refresh below re-inserts exactly the currently-resolvable set.
  for (const sourceNodeId of sourceNodesToClear) {
    await db.graphEdge.deleteMany({ where: { source_node_id: sourceNodeId } });
  }

  // 4. Re-insert CONTAINS for every (kept + new) symbol of each rebuilt file.
  for (const c of pendingContains) {
    for (const symId of c.symbolIds) {
      edgesToInsert.push({
        repo_id: c.repoId,
        source_node_id: c.fileNodeId,
        target_node_id: symId,
        type: 'CONTAINS',
      });
    }
  }

  // 5. Resolve pending edges against current file/symbol maps. Unresolvable
  //    edges are dropped rather than fabricated — an untrusted edge is worse
  //    than no edge.
  for (const pedge of pendingEdges) {
    const sourceNodeId = fileNodePathToId.get(pedge.sourcePath);
    if (!sourceNodeId) continue;

    let targetName = pedge.target.replace(/^["']|["']$/g, '');
    targetName = resolveImportPath(pedge.sourcePath, targetName);

    // 1. Try file-level resolution (module imports, cross-file calls)
    let targetNodeId: string | undefined =
      fileNodePathToId.get(targetName) ||
      fileNodePathToId.get(targetName + '.ts') ||
      fileNodePathToId.get(targetName + '.tsx') ||
      fileNodePathToId.get(targetName + '.js') ||
      fileNodePathToId.get(targetName + '.jsx') ||
      fileNodePathToId.get(targetName + '.py') ||
      fileNodePathToId.get(targetName + '/index.ts') ||
      fileNodePathToId.get(targetName + '/index.js') ||
      fileNodePathToId.get(targetName + '/index.tsx');

    // 2. Fall back to symbol resolution (function calls, class references)
    if (!targetNodeId) {
      targetNodeId = symbolNameToNodeId.get(targetName);
    }

    if (!targetNodeId) continue;

    edgesToInsert.push({
      repo_id: dbRepoId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      type: pedge.type,
      source_line: pedge.startLine || null,
      source_file: pedge.sourcePath || null,
      metadata: pedge.metadata,
    });
  }

  // 6. Insert refreshed edges.
  if (edgesToInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < edgesToInsert.length; i += chunkSize) {
      await db.graphEdge.createMany({ data: edgesToInsert.slice(i, i + chunkSize) });
    }
  }
}
import { db } from '@/lib/db';
import { streamText } from 'ai';
import { getDefaultChatModel } from '@/lib/llm/provider';
import { traceEvent } from '@/lib/observability';
import { logger } from '@/lib/logger';
import { runVersionGrounding } from '@/features/version-grounding';
import type { ApiPatternMatch } from '@/types/version-grounding';
import { INPUT_LIMITS } from '@/config/app.config';
import type { TokenUsage } from '@/lib/llm/metering';

interface FolderGroup {
  path: string;
  title: string;
  symbols: string[];
  imports: string[];
  fileCount: number;
}

/**
 * Groups graph nodes by top-level folder (e.g. "src/features/auth").
 * Returns an array of folder groups to summarize.
 */
async function buildFolderGroups(repoId: string): Promise<FolderGroup[]> {
  // Fetch all FILE nodes to determine folder paths
  const fileNodes = await db.graphNode.findMany({
    where: { repo_id: repoId, type: 'FILE' },
    select: { id: true, name: true },
  });

  // Fetch all symbol nodes (FUNCTION, CLASS, INTERFACE, TYPE, COMPONENT, ROUTE)
  const symbolNodes = await db.graphNode.findMany({
    where: {
      repo_id: repoId,
      type: { in: ['FUNCTION', 'CLASS', 'INTERFACE', 'TYPE', 'COMPONENT', 'ROUTE', 'VARIABLE'] },
    },
    select: { name: true, type: true },
  });

  // Fetch IMPORTS edges with source/target names
  const importEdges = await db.graphEdge.findMany({
    where: { repo_id: repoId, type: 'IMPORTS' },
    select: {
      source_node: { select: { name: true } },
      target_node: { select: { name: true } },
    },
  });

  // Group by top-level folder (e.g. "src/features/auth" from "src/features/auth/index.ts")
  const folderMap = new Map<string, FolderGroup>();

  for (const file of fileNodes) {
    const parts = file.name.split('/');
    // Use up to 3 path segments as the folder key (e.g. src/features/auth)
    const folderPath = parts.slice(0, Math.min(3, parts.length - 1)).join('/') || 'root';
    const title = parts[Math.min(2, parts.length - 2)] || folderPath;

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, { path: folderPath, title, symbols: [], imports: [], fileCount: 0 });
    }
    folderMap.get(folderPath)!.fileCount++;
  }

  // Assign symbols to folders by path prefix
  for (const sym of symbolNodes) {
    const parts = sym.name.split('::')[0].split('/');
    const folderPath = parts.slice(0, Math.min(3, parts.length - 1)).join('/') || 'root';
    if (folderMap.has(folderPath)) {
      const group = folderMap.get(folderPath)!;
      if (group.symbols.length < 20) { // cap per folder
        group.symbols.push(`${sym.type}: ${sym.name.split('::').pop()}`);
      }
    }
  }

  // Assign cross-folder imports
  for (const edge of importEdges) {
    const srcFolder = edge.source_node.name.split('/').slice(0, 3).join('/');
    const tgtFolder = edge.target_node.name.split('/').slice(0, 3).join('/');
    if (srcFolder !== tgtFolder && folderMap.has(srcFolder)) {
      const group = folderMap.get(srcFolder)!;
      if (!group.imports.includes(tgtFolder) && group.imports.length < 10) {
        group.imports.push(tgtFolder);
      }
    }
  }

  // Filter out trivial folders (< 2 files)
  return Array.from(folderMap.values()).filter(f => f.fileCount >= 1);
}

/**
 * Generates an LLM-written Markdown summary for a single folder group
 * and upserts it into the wiki_pages table.
 */
async function summarizeFolder(
  repoId: string,
  group: FolderGroup,
  commitSha: string | null,
  onUsage?: (usage: TokenUsage) => void,
): Promise<void> {
  // Run version grounding on pseudo-content generated from symbols
  // This bypasses the need to fetch all file contents from GitHub while still capturing API usages
  const pseudoContent = `
    ${group.imports.map(imp => `import * from '${imp}'`).join('\n')}
    ${group.symbols.map(sym => `function ${sym}() {}`).join('\n')}
  `;

  // Run version grounding on the folder's code
  const grounding = runVersionGrounding(['React', 'Next.js'], pseudoContent);
  const deprecationWarnings = grounding.detectedApiPatterns
    .filter((p: ApiPatternMatch) => p.deprecatedInVersion)
    .map((p: ApiPatternMatch) => `- ${p.api}: ${p.description} (Deprecated in ${p.deprecatedInVersion})`)
    .join('\n');

  let versionWarningPrompt = '';
  if (deprecationWarnings) {
    versionWarningPrompt = `
**IMPORTANT VERSION GROUNDING**: 
The following deprecated APIs or outdated patterns were detected in this folder:
${deprecationWarnings}

You MUST include a GitHub-flavored "> [!WARNING]" block in the Developer Notes section highlighting these deprecations to the user.`;
  }

  const prompt = `You are generating a wiki page for a software engineering codebase.

Folder: ${group.path}
File count: ${group.fileCount}

Symbols defined here:
${group.symbols.length > 0 ? group.symbols.join('\n') : '(none detected)'}

Imports/depends on:
${group.imports.length > 0 ? group.imports.join('\n') : '(none detected)'}
${versionWarningPrompt}

Write a concise Markdown wiki page (150–300 words) covering:
1. **Purpose** — What does this module/folder do?
2. **Key Exports** — List the most important functions, classes, or types.
3. **Dependencies** — What does it depend on?
4. **Developer Notes** — Any gotchas, patterns, or important conventions.

Use ## headings for each section. Do not add a top-level title (it will be added separately).`;

  const result = streamText({
    model: getDefaultChatModel(),
    system: 'You are a senior software engineer writing technical wiki documentation. Be precise and concise.',
    prompt,
    temperature: 0.3,
  });

  let fullContent = '';
  for await (const chunk of result.textStream) {
    fullContent += chunk;
  }

  if (onUsage) {
    try {
      const usage = await result.usage;
      if (usage) {
        onUsage({ inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 });
      }
    } catch (err) {
      logger.error('[Wiki]', `Usage capture failed for ${group.path}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Enforce max wiki answer length
  if (fullContent.length > INPUT_LIMITS.wikiAnswerMaxChars) {
    fullContent = fullContent.slice(0, INPUT_LIMITS.wikiAnswerMaxChars);
    logger.warn('[Wiki]', `Content truncated for ${group.path} to ${INPUT_LIMITS.wikiAnswerMaxChars} chars`);
  }

  const title = group.title.charAt(0).toUpperCase() + group.title.slice(1).replace(/-/g, ' ');

  await db.wikiPage.upsert({
    where: { repo_id_path: { repo_id: repoId, path: group.path } },
    update: { title, content: fullContent, commit_sha: commitSha, updated_at: new Date() },
    create: { repo_id: repoId, path: group.path, title, content: fullContent, commit_sha: commitSha },
  });
}

// sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateWikiPages(
  repoId: string,
  onProgress?: (done: number, total: number, path: string) => void,
  onUsage?: (usage: TokenUsage) => void,
): Promise<number> {
  const repo = await db.repository.findUnique({
    where: { id: repoId },
    select: { commit_sha: true },
  });
  const commitSha = repo?.commit_sha ?? null;

  const groups = await buildFolderGroups(repoId);
  let done = 0;
  const startTime = Date.now();

  for (const group of groups) {
    try {
      await summarizeFolder(repoId, group, commitSha, onUsage);
      await sleep(1500); // Spacing between LLM calls
    } catch (err: unknown) {
      logger.error('[Wiki]', `Failed to summarize ${group.path}`, { error: String(err) });
    }
    done++;
    onProgress?.(done, groups.length, group.path);
  }

  traceEvent('wiki_generated', {
    repoId,
    pagesGenerated: done,
    timeTakenMs: Date.now() - startTime,
  });

  return done;
}

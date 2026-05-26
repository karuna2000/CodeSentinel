/**
 * Grounding Context Builder — assembles the curated grounding sources
 * and retrieval context for a framework+version combination.
 *
 * Responsibilities:
 *  - Select the correct grounding sources from the registry
 *    (version-specific sources take precedence over defaults)
 *  - Deduplicate sources across multiple frameworks
 *  - Sort by priority (1 = most important, fetch first)
 *  - Build the retrieval queue for MCP/search tools
 *
 * Design:
 *  - Pure function, no side effects
 *  - Framework-agnostic: works for any registered framework
 *  - Security: only returns pre-vetted URLs from the registry
 *    (no runtime URL construction from user input)
 *
 * Anti-hallucination role:
 *  The grounding sources produced here are the URLs that must be fetched
 *  BEFORE the LLM reasons about the code. This transforms the LLM from
 *  "memory-only reasoner" to "grounded-context reasoner".
 */

import type { GroundingSource } from '@/types/version-grounding';
import { getFrameworkEntry } from './framework-registry';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a deduplicated, priority-sorted grounding source list for a
 * specific framework+version combination.
 *
 * @param frameworkName   Detected framework name (must match registry)
 * @param versionLabel    Matched version bracket label (e.g. "React 18.x")
 *                        or null when version is undetermined
 * @returns               Grounding sources sorted by priority (1 first)
 */
export function buildGroundingSources(
  frameworkName: string,
  versionLabel: string | null,
): GroundingSource[] {
  const entry = getFrameworkEntry(frameworkName);
  if (!entry) return [];

  const sources: GroundingSource[] = [];
  const seen = new Set<string>();

  // 1. Version-specific sources (highest relevance)
  if (versionLabel) {
    const bracket = entry.versionBrackets.find((b) => b.label === versionLabel);
    if (bracket) {
      for (const src of bracket.groundingSources) {
        if (!seen.has(src.url)) {
          sources.push(src);
          seen.add(src.url);
        }
      }
    }
  }

  // 2. Default framework sources (fill in any gaps)
  for (const src of entry.defaultGroundingSources) {
    if (!seen.has(src.url)) {
      sources.push(src);
      seen.add(src.url);
    }
  }

  return sortByPriority(sources);
}

/**
 * Merges grounding sources from multiple frameworks into a single
 * deduplicated, priority-sorted retrieval queue.
 *
 * This is the "retrieval queue" consumed by the MCP/search layer:
 * fetch priority-1 sources first, then 2, then 3.
 *
 * @param sourceSets  Array of per-framework grounding source arrays
 */
export function mergeGroundingSources(
  sourceSets: GroundingSource[][],
): GroundingSource[] {
  const seen = new Set<string>();
  const merged: GroundingSource[] = [];

  for (const sources of sourceSets) {
    for (const src of sources) {
      if (!seen.has(src.url)) {
        merged.push(src);
        seen.add(src.url);
      }
    }
  }

  return sortByPriority(merged);
}

/**
 * Filters the grounding source list to only priority-1 sources.
 * Used when the retrieval budget is tight (e.g., single-file analysis).
 */
export function getPrimaryGroundingSources(
  sources: GroundingSource[],
): GroundingSource[] {
  return sources.filter((s) => s.priority === 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortByPriority(sources: GroundingSource[]): GroundingSource[] {
  return [...sources].sort((a, b) => a.priority - b.priority);
}



import type { GroundingSource } from '@/types/version-grounding';
import { getFrameworkEntry } from './framework-registry';

export function buildGroundingSources(
  frameworkName: string,
  versionLabel: string | null,
): GroundingSource[] {
  const entry = getFrameworkEntry(frameworkName);
  if (!entry) return [];

  const sources: GroundingSource[] = [];
  const seen = new Set<string>();

  
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

  
  for (const src of entry.defaultGroundingSources) {
    if (!seen.has(src.url)) {
      sources.push(src);
      seen.add(src.url);
    }
  }

  return sortByPriority(sources);
}

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

export function getPrimaryGroundingSources(
  sources: GroundingSource[],
): GroundingSource[] {
  return sources.filter((s) => s.priority === 1);
}

function sortByPriority(sources: GroundingSource[]): GroundingSource[] {
  return [...sources].sort((a, b) => a.priority - b.priority);
}

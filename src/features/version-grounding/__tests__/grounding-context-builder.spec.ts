/**
 * Tests for the Grounding Context Builder.
 */

import { describe, it, expect } from 'vitest';
import {
  buildGroundingSources,
  mergeGroundingSources,
  getPrimaryGroundingSources,
} from '@/features/version-grounding/grounding-context-builder';

describe('buildGroundingSources — React', () => {
  it('returns React 18-specific sources for React 18.x label', () => {
    const sources = buildGroundingSources('React', 'React 18.x');
    expect(sources.length).toBeGreaterThan(0);
    const urls = sources.map((s) => s.url);
    expect(urls.some((u) => u.includes('react.dev'))).toBe(true);
  });

  it('includes a priority-1 source for React 18', () => {
    const sources = buildGroundingSources('React', 'React 18.x');
    expect(sources.some((s) => s.priority === 1)).toBe(true);
  });

  it('returns default sources when version label is null', () => {
    const sources = buildGroundingSources('React', null);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((s) => s.url.includes('react.dev'))).toBe(true);
  });

  it('sources are sorted by priority (1 first)', () => {
    const sources = buildGroundingSources('React', 'React 18.x');
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i].priority).toBeGreaterThanOrEqual(sources[i - 1].priority);
    }
  });
});

describe('buildGroundingSources — Next.js', () => {
  it('returns App Router docs for Next.js 13-14 label', () => {
    const sources = buildGroundingSources('Next.js', 'Next.js 13–14.x (App Router)');
    const urls = sources.map((s) => s.url);
    expect(urls.some((u) => u.includes('nextjs.org'))).toBe(true);
  });

  it('returns empty array for unknown framework', () => {
    const sources = buildGroundingSources('NonExistentFramework', null);
    expect(sources).toHaveLength(0);
  });
});

describe('buildGroundingSources — deduplication', () => {
  it('does not return duplicate URLs', () => {
    const sources = buildGroundingSources('React', 'React 18.x');
    const urls = sources.map((s) => s.url);
    const unique = [...new Set(urls)];
    expect(urls.length).toBe(unique.length);
  });
});

describe('mergeGroundingSources', () => {
  it('merges sources from multiple frameworks', () => {
    const reactSources = buildGroundingSources('React', 'React 18.x');
    const nextSources = buildGroundingSources('Next.js', 'Next.js 13–14.x (App Router)');
    const merged = mergeGroundingSources([reactSources, nextSources]);
    expect(merged.length).toBeGreaterThanOrEqual(Math.max(reactSources.length, nextSources.length));
  });

  it('deduplicates identical URLs across frameworks', () => {
    const sources = buildGroundingSources('React', 'React 18.x');
    const merged = mergeGroundingSources([sources, sources]);
    const urls = merged.map((s) => s.url);
    const unique = [...new Set(urls)];
    expect(urls.length).toBe(unique.length);
  });

  it('sorts merged result by priority (1 first)', () => {
    const reactSources = buildGroundingSources('React', 'React 18.x');
    const nextSources = buildGroundingSources('Next.js', null);
    const merged = mergeGroundingSources([reactSources, nextSources]);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].priority).toBeGreaterThanOrEqual(merged[i - 1].priority);
    }
  });

  it('handles empty array input', () => {
    expect(mergeGroundingSources([])).toHaveLength(0);
  });
});

describe('getPrimaryGroundingSources', () => {
  it('returns only priority-1 sources', () => {
    const all = buildGroundingSources('React', 'React 18.x');
    const primary = getPrimaryGroundingSources(all);
    for (const src of primary) {
      expect(src.priority).toBe(1);
    }
  });

  it('returns a subset of the input', () => {
    const all = buildGroundingSources('Next.js', 'Next.js 13–14.x (App Router)');
    const primary = getPrimaryGroundingSources(all);
    expect(primary.length).toBeLessThanOrEqual(all.length);
  });
});

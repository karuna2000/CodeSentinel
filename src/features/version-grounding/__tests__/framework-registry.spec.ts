

import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_REGISTRY,
  getFrameworkEntry,
  getAllApiPatterns,
  REACT_ENTRY,
  NEXTJS_ENTRY,
  EXPRESS_ENTRY,
  PRISMA_ENTRY,
} from '@/features/version-grounding/framework-registry';

describe('FRAMEWORK_REGISTRY — structure', () => {
  it('contains all expected frameworks', () => {
    const names = Object.keys(FRAMEWORK_REGISTRY);
    expect(names).toContain('React');
    expect(names).toContain('Next.js');
    expect(names).toContain('Express');
    expect(names).toContain('Prisma');
    expect(names).toContain('Vue');
    expect(names).toContain('NestJS');
    expect(names).toContain('FastAPI');
  });

  it('each entry has a non-empty name', () => {
    for (const entry of Object.values(FRAMEWORK_REGISTRY)) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('each entry has at least one version bracket', () => {
    for (const entry of Object.values(FRAMEWORK_REGISTRY)) {
      expect(entry.versionBrackets.length).toBeGreaterThan(0);
    }
  });

  it('each entry has at least one default grounding source', () => {
    for (const entry of Object.values(FRAMEWORK_REGISTRY)) {
      expect(entry.defaultGroundingSources.length).toBeGreaterThan(0);
    }
  });

  it('each grounding source has a valid URL', () => {
    for (const entry of Object.values(FRAMEWORK_REGISTRY)) {
      for (const src of entry.defaultGroundingSources) {
        expect(src.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it('grounding source priorities are 1, 2, or 3', () => {
    for (const entry of Object.values(FRAMEWORK_REGISTRY)) {
      for (const bracket of entry.versionBrackets) {
        for (const src of bracket.groundingSources) {
          expect([1, 2, 3]).toContain(src.priority);
        }
      }
    }
  });
});

describe('getFrameworkEntry', () => {
  it('returns React entry for "React"', () => {
    const entry = getFrameworkEntry('React');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('React');
  });

  it('returns Next.js entry for "Next.js"', () => {
    const entry = getFrameworkEntry('Next.js');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Next.js');
  });

  it('returns undefined for unknown frameworks', () => {
    expect(getFrameworkEntry('UnknownFramework')).toBeUndefined();
    expect(getFrameworkEntry('')).toBeUndefined();
  });
});

describe('getAllApiPatterns', () => {
  it('returns a non-empty array', () => {
    const patterns = getAllApiPatterns();
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('includes React 18 patterns', () => {
    const patterns = getAllApiPatterns();
    expect(patterns.some((p) => p.api === 'useTransition()' && p.framework === 'React')).toBe(true);
    expect(patterns.some((p) => p.api === 'createRoot()' && p.framework === 'React')).toBe(true);
  });

  it('includes deprecated API markers', () => {
    const patterns = getAllApiPatterns();
    const deprecated = patterns.filter((p) => p.deprecatedInVersion !== null);
    expect(deprecated.length).toBeGreaterThan(0);
    
    expect(deprecated.some((p) => p.api === 'ReactDOM.render()')).toBe(true);
  });

  it('includes introducedInVersion for every pattern', () => {
    const patterns = getAllApiPatterns();
    for (const p of patterns) {
      expect(typeof p.introducedInVersion).toBe('string');
      expect(p.introducedInVersion.length).toBeGreaterThan(0);
    }
  });
});

describe('REACT_ENTRY — version brackets', () => {
  it('has React 19 bracket before React 18', () => {
    const brackets = REACT_ENTRY.versionBrackets;
    const v19Idx = brackets.findIndex((b) => b.label.includes('19'));
    const v18Idx = brackets.findIndex((b) => b.label.includes('18'));
    expect(v19Idx).toBeLessThan(v18Idx);
  });

  it('React 18 bracket has correct minVersion', () => {
    const bracket = REACT_ENTRY.versionBrackets.find((b) => b.label.includes('18'));
    expect(bracket?.minVersion).toBe('18.0');
  });
});

describe('NEXTJS_ENTRY — version brackets', () => {
  it('has Next.js 15 bracket as most recent', () => {
    const first = NEXTJS_ENTRY.versionBrackets[0];
    expect(first.label).toContain('15');
  });

  it('includes App Router bracket', () => {
    const bracket = NEXTJS_ENTRY.versionBrackets.find((b) =>
      b.label.includes('App Router'),
    );
    expect(bracket).toBeDefined();
    expect(bracket!.minVersion).toBe('13.0');
  });
});

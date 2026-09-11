import { describe, it, expect } from 'vitest';
import {
  computeSymbolChanges,
  isIndexableFile,
  type SymbolNodeRef,
} from '@/features/github/indexer/github-client';
import type { ExtractedSymbol } from '@/features/code-intelligence/symbol-extractor';

function symbolRef(id: string, name: string, contentHash: string | null, type: ExtractedSymbol['type'] = 'FUNCTION'): SymbolNodeRef {
  return { id, name, type, contentHash };
}

function newSymbol(name: string, contentHash: string): ExtractedSymbol {
  return {
    type: 'FUNCTION',
    name,
    startLine: 1,
    endLine: 3,
    startByte: 0,
    endByte: 10,
    signature: `function ${name}() {}`,
    codeSnippet: `function ${name}() {}`,
    documentation: '',
    contentHash,
  };
}

describe('GitHub Indexer Filtering', () => {
  it('identifies source code files as indexable', () => {
    expect(isIndexableFile('src/index.ts')).toBe(true);
    expect(isIndexableFile('app/components/Button.tsx')).toBe(true);
    expect(isIndexableFile('lib/utils.js')).toBe(true);
    expect(isIndexableFile('backend/main.py')).toBe(true);
    expect(isIndexableFile('README.md')).toBe(true);
    expect(isIndexableFile('package.json')).toBe(true);
  });

  it('rejects dependency and build output folders', () => {
    expect(isIndexableFile('node_modules/react/index.js')).toBe(false);
    expect(isIndexableFile('.next/static/chunks/app.js')).toBe(false);
    expect(isIndexableFile('dist/bundle.js')).toBe(false);
    expect(isIndexableFile('.git/config')).toBe(false);
    expect(isIndexableFile('build/index.html')).toBe(false);
  });

  it('rejects binary, media, and lock files', () => {
    expect(isIndexableFile('public/logo.png')).toBe(false);
    expect(isIndexableFile('assets/video.mp4')).toBe(false);
    expect(isIndexableFile('fonts/inter.woff2')).toBe(false);
    expect(isIndexableFile('package-lock.json')).toBe(false);
    expect(isIndexableFile('yarn.lock')).toBe(false);
    expect(isIndexableFile('pnpm-lock.yaml')).toBe(true); // YAML config is text
  });
});

describe('computeSymbolChanges (content_hash gating)', () => {
  it('keeps symbols whose content hash is unchanged', () => {
    const old = [symbolRef('n1', 'foo', 'h1')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1')]);
    expect(result.keep.map((k) => k.id)).toEqual(['n1']);
    expect(result.delete).toEqual([]);
    expect(result.create).toEqual([]);
  });

  it('replaces changed symbols (delete old id + create new)', () => {
    const old = [symbolRef('n1', 'foo', 'h1')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h2')]);
    expect(result.keep).toEqual([]);
    expect(result.delete.map((d) => d.id)).toEqual(['n1']);
    expect(result.create.map((c) => c.name)).toEqual(['foo']);
  });

  it('deletes symbols removed from the file', () => {
    const old = [symbolRef('n1', 'foo', 'h1'), symbolRef('n2', 'bar', 'h1')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1')]);
    expect(result.keep.map((k) => k.id)).toEqual(['n1']);
    expect(result.delete.map((d) => d.id)).toEqual(['n2']);
    expect(result.create).toEqual([]);
  });

  it('creates brand-new symbols without touching others', () => {
    const old = [symbolRef('n1', 'foo', 'h1')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1'), newSymbol('baz', 'h9')]);
    expect(result.keep.map((k) => k.id)).toEqual(['n1']);
    expect(result.delete).toEqual([]);
    expect(result.create.map((c) => c.name)).toEqual(['baz']);
  });

  it('treats legacy symbols with a null content_hash as changed', () => {
    const old = [symbolRef('n1', 'foo', null)];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1')]);
    expect(result.keep).toEqual([]);
    expect(result.delete.map((d) => d.id)).toEqual(['n1']);
    expect(result.create.map((c) => c.name)).toEqual(['foo']);
  });

  it('ignores duplicate symbol names within the same file', () => {
    const old = [symbolRef('n1', 'foo', 'h1')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1'), newSymbol('foo', 'h1')]);
    expect(result.create).toEqual([]);
    expect(result.keep.map((k) => k.id)).toEqual(['n1']);
  });

  it('distinguishes same name across symbol types', () => {
    const old = [symbolRef('n1', 'foo', 'h1', 'CLASS')];
    const result = computeSymbolChanges(old, [newSymbol('foo', 'h1')]);
    expect(result.keep).toEqual([]);
    expect(result.create.map((c) => c.name)).toEqual(['foo']);
  });
});

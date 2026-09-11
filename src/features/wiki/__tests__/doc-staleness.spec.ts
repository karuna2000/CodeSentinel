import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    repository: { findUnique: vi.fn() },
    wikiPage: { findMany: vi.fn() },
    diagram: { findMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { computeDocStaleness, getDocStaleness } from '../services/doc-staleness';

describe('computeDocStaleness', () => {
  it('reports fresh when all artifacts match the index commit', () => {
    const result = computeDocStaleness('sha1', ['sha1', 'sha1'], ['sha1']);
    expect(result).toEqual({
      stale: false,
      indexCommitSha: 'sha1',
      stalePages: 0,
      staleDiagrams: 0,
    });
  });

  it('flags pages/diagrams behind the index commit', () => {
    const result = computeDocStaleness('sha2', ['sha1', 'sha2'], ['sha1']);
    expect(result.stale).toBe(true);
    expect(result.stalePages).toBe(1);
    expect(result.staleDiagrams).toBe(1);
  });

  it('treats pre-tracking NULL commits as stale once an index baseline exists', () => {
    const result = computeDocStaleness('sha1', [null], [null]);
    expect(result.stale).toBe(true);
    expect(result.stalePages).toBe(1);
    expect(result.staleDiagrams).toBe(1);
  });

  it('is not stale when the repo has never been indexed', () => {
    const result = computeDocStaleness(null, ['sha1', null], ['sha1']);
    expect(result.stale).toBe(false);
    expect(result.stalePages).toBe(0);
    expect(result.staleDiagrams).toBe(0);
  });
});

describe('getDocStaleness', () => {
  it('folds fetched rows into the pure computation', async () => {
    (db.repository.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ commit_sha: 'shaX' });
    (db.wikiPage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ commit_sha: 'shaOld' }]);
    (db.diagram.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ commit_sha: 'shaX' }]);

    const result = await getDocStaleness('repo-1');
    expect(result.stale).toBe(true);
    expect(result.stalePages).toBe(1);
    expect(result.staleDiagrams).toBe(0);

    expect(db.repository.findUnique).toHaveBeenCalledWith({
      where: { id: 'repo-1' },
      select: { commit_sha: true },
    });
  });
});
import { db } from '@/lib/db';

export interface DocStaleness {
  /** True when any wiki page or diagram was generated from an older index than the repo's current HEAD. */
  stale: boolean;
  /** Repo HEAD commit SHA at last index. Null when the repo has never been indexed. */
  indexCommitSha: string | null;
  /** Number of wiki pages generated from an older commit (or pre-tracking rows). */
  stalePages: number;
  /** Number of diagrams generated from an older commit (or pre-tracking rows). */
  staleDiagrams: number;
}

/**
 * Pure staleness computation: an artifact is stale when it wasn't generated
 * from the repo's current index commit SHA. Pre-tracking rows (NULL) are stale
 * whenever there is an index baseline to compare against.
 */
export function computeDocStaleness(
  indexCommitSha: string | null,
  pageCommitShas: (string | null)[],
  diagramCommitShas: (string | null)[],
): DocStaleness {
  if (!indexCommitSha) {
    return { stale: false, indexCommitSha, stalePages: 0, staleDiagrams: 0 };
  }

  const isStale = (sha: string | null) => sha !== indexCommitSha;
  const stalePages = pageCommitShas.filter(isStale).length;
  const staleDiagrams = diagramCommitShas.filter(isStale).length;

  return {
    stale: stalePages > 0 || staleDiagrams > 0,
    indexCommitSha,
    stalePages,
    staleDiagrams,
  };
}

/**
 * Compares the repo's indexed commit SHA against the commit each wiki page and
 * diagram was generated from. Anything behind the current index is stale —
 * the repo advanced after the docs were written.
 */
export async function getDocStaleness(repoId: string): Promise<DocStaleness> {
  const [repo, pages, diagrams] = await Promise.all([
    db.repository.findUnique({ where: { id: repoId }, select: { commit_sha: true } }),
    db.wikiPage.findMany({ where: { repo_id: repoId }, select: { commit_sha: true } }),
    db.diagram.findMany({ where: { repo_id: repoId }, select: { commit_sha: true } }),
  ]);

  return computeDocStaleness(
    repo?.commit_sha ?? null,
    pages.map((p) => p.commit_sha),
    diagrams.map((d) => d.commit_sha),
  );
}
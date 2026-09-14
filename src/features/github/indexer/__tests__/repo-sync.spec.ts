import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    repository: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/features/github/indexer/github-client', () => ({
  getInstallationRepositories: vi.fn(),
}));

vi.mock('@/features/github/indexer/installation-resolver', () => ({
  resolveCurrentInstallations: vi.fn(),
  discoverAndClaimUserInstallation: vi.fn(),
}));

import { db } from '@/lib/db';
import { getInstallationRepositories } from '@/features/github/indexer/github-client';
import {
  discoverAndClaimUserInstallation,
  resolveCurrentInstallations,
} from '@/features/github/indexer/installation-resolver';
import { syncUserRepositories } from '../repo-sync';

describe('syncUserRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers and claims a GitHub App install when none is cached', async () => {
    vi.mocked(resolveCurrentInstallations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { installation_id: 42, account_name: 'karuna2000' },
      ]);
    vi.mocked(discoverAndClaimUserInstallation).mockResolvedValue({
      installation_id: 42,
      account_name: 'karuna2000',
    });
    vi.mocked(getInstallationRepositories).mockResolvedValue([
      {
        id: 1,
        name: 'CodeSentinel',
        owner: { login: 'karuna2000' },
        default_branch: 'main',
        language: 'TypeScript',
        description: null,
        stargazers_count: 0,
      },
    ] as never);
    vi.mocked(db.repository.upsert).mockResolvedValue({} as never);
    vi.mocked(db.repository.findMany).mockResolvedValue([{ id: 'repo-1' }] as never);

    const repos = await syncUserRepositories('user-a', 'karuna2000');

    expect(discoverAndClaimUserInstallation).toHaveBeenCalledWith(
      'user-a',
      'karuna2000',
    );
    expect(getInstallationRepositories).toHaveBeenCalledWith(42);
    expect(repos).toEqual([{ id: 'repo-1' }]);
  });

  it('skips discovery when installations are already bound', async () => {
    vi.mocked(resolveCurrentInstallations).mockResolvedValue([
      { installation_id: 7, account_name: 'acme' },
    ]);
    vi.mocked(getInstallationRepositories).mockResolvedValue([]);
    vi.mocked(db.repository.findMany).mockResolvedValue([]);

    await syncUserRepositories('user-a', 'karuna2000');

    expect(discoverAndClaimUserInstallation).not.toHaveBeenCalled();
  });
});

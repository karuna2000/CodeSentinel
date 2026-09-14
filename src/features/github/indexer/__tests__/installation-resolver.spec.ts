import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    githubInstallation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/features/github/indexer/github-client', () => ({
  getAppClient: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    githubAppId: '1',
    githubAppPrivateKey: 'test-key',
  },
}));

import { db } from '@/lib/db';
import { getAppClient } from '@/features/github/indexer/github-client';
import {
  claimGithubInstallation,
  discoverAndClaimUserInstallation,
  InstallationClaimError,
  resolveCurrentInstallations,
} from '../installation-resolver';

const dbMock = db as unknown as {
  githubInstallation: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

function mockAppClient(
  getInstallation: ReturnType<typeof vi.fn>,
  getUserInstallation: ReturnType<typeof vi.fn> = vi.fn(),
) {
  vi.mocked(getAppClient).mockResolvedValue({
    rest: {
      apps: {
        getInstallation,
        getUserInstallation,
        listInstallations: vi.fn(),
      },
    },
  } as never);
}

describe('claimGithubInstallation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a row for an unclaimed installation', async () => {
    mockAppClient(
      vi.fn().mockResolvedValue({ data: { account: { login: 'acme' } } }),
    );
    dbMock.githubInstallation.findUnique.mockResolvedValue(null);
    dbMock.githubInstallation.upsert.mockResolvedValue({
      installation_id: BigInt(42),
      account_name: 'acme',
    });

    const claimed = await claimGithubInstallation('user-a', 42);
    expect(claimed).toEqual({ installation_id: 42, account_name: 'acme' });
    expect(dbMock.githubInstallation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ user_id: 'user-a', installation_id: 42 }),
        update: { account_name: 'acme' },
      }),
    );
  });

  it('refuses to reassign an installation owned by another user', async () => {
    mockAppClient(
      vi.fn().mockResolvedValue({ data: { account: { login: 'acme' } } }),
    );
    dbMock.githubInstallation.findUnique.mockResolvedValue({ user_id: 'user-a' });

    await expect(claimGithubInstallation('user-b', 42)).rejects.toMatchObject({
      name: 'InstallationClaimError',
      code: 'conflict',
    });
    expect(dbMock.githubInstallation.upsert).not.toHaveBeenCalled();
  });

  it('rejects unknown GitHub installations', async () => {
    mockAppClient(vi.fn().mockRejectedValue({ status: 404 }));
    await expect(claimGithubInstallation('user-a', 99)).rejects.toBeInstanceOf(
      InstallationClaimError,
    );
  });
});

describe('resolveCurrentInstallations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never lists every App installation globally', async () => {
    const listInstallations = vi.fn();
    const getInstallation = vi.fn().mockResolvedValue({
      data: { account: { login: 'acme' } },
    });
    vi.mocked(getAppClient).mockResolvedValue({
      rest: { apps: { getInstallation, listInstallations } },
    } as never);

    dbMock.githubInstallation.findMany.mockResolvedValue([
      { id: 'row-1', installation_id: BigInt(7), account_name: 'acme' },
    ]);
    dbMock.githubInstallation.updateMany.mockResolvedValue({ count: 0 });

    const resolved = await resolveCurrentInstallations('user-a');
    expect(resolved).toEqual([{ installation_id: 7, account_name: 'acme' }]);
    expect(listInstallations).not.toHaveBeenCalled();
    expect(getInstallation).toHaveBeenCalledWith({ installation_id: 7 });
  });

  it('drops only this user\'s row when GitHub reports the install gone', async () => {
    mockAppClient(vi.fn().mockRejectedValue({ status: 404 }));
    dbMock.githubInstallation.findMany.mockResolvedValue([
      { id: 'row-1', installation_id: BigInt(7), account_name: 'acme' },
    ]);
    dbMock.githubInstallation.deleteMany.mockResolvedValue({ count: 1 });

    const resolved = await resolveCurrentInstallations('user-a');
    expect(resolved).toEqual([]);
    expect(dbMock.githubInstallation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'row-1', user_id: 'user-a' },
    });
  });
});

describe('discoverAndClaimUserInstallation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims the personal-account installation for the signed-in GitHub user', async () => {
    const getUserInstallation = vi.fn().mockResolvedValue({
      data: { id: 42, account: { login: 'karuna2000' } },
    });
    const getInstallation = vi.fn().mockResolvedValue({
      data: { account: { login: 'karuna2000' } },
    });
    mockAppClient(getInstallation, getUserInstallation);
    dbMock.githubInstallation.findUnique.mockResolvedValue(null);
    dbMock.githubInstallation.upsert.mockResolvedValue({
      installation_id: BigInt(42),
      account_name: 'karuna2000',
    });

    const claimed = await discoverAndClaimUserInstallation('user-a', 'karuna2000');
    expect(claimed).toEqual({ installation_id: 42, account_name: 'karuna2000' });
    expect(getUserInstallation).toHaveBeenCalledWith({ username: 'karuna2000' });
  });

  it('returns null when GitHub reports no user installation', async () => {
    mockAppClient(
      vi.fn(),
      vi.fn().mockRejectedValue({ status: 404 }),
    );
    await expect(
      discoverAndClaimUserInstallation('user-a', 'karuna2000'),
    ).resolves.toBeNull();
    expect(dbMock.githubInstallation.upsert).not.toHaveBeenCalled();
  });

  it('does not steal an installation owned by another user', async () => {
    mockAppClient(
      vi.fn().mockResolvedValue({ data: { account: { login: 'karuna2000' } } }),
      vi.fn().mockResolvedValue({
        data: { id: 42, account: { login: 'karuna2000' } },
      }),
    );
    dbMock.githubInstallation.findUnique.mockResolvedValue({ user_id: 'user-b' });

    await expect(
      discoverAndClaimUserInstallation('user-a', 'karuna2000'),
    ).resolves.toBeNull();
    expect(dbMock.githubInstallation.upsert).not.toHaveBeenCalled();
  });
});

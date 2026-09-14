import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { getAppClient } from '@/features/github/indexer/github-client';

export interface ResolvedInstallation {
  installation_id: number;
  account_name: string;
}

export type InstallationClaimCode = 'invalid' | 'not_found' | 'conflict';

export class InstallationClaimError extends Error {
  constructor(public readonly code: InstallationClaimCode) {
    super(`GitHub App installation claim failed: ${code}`);
    this.name = 'InstallationClaimError';
  }
}

function accountNameOf(account: unknown): string {
  if (!account || typeof account !== 'object') return 'Account';
  const rec = account as { login?: unknown; name?: unknown };
  if (typeof rec.login === 'string' && rec.login.trim()) return rec.login;
  if (typeof rec.name === 'string' && rec.name.trim()) return rec.name;
  return 'Account';
}

function isNotFoundError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status?: number }).status === 404,
  );
}

/**
 * Binds a GitHub App installation to the signed-in user.
 *
 * GitHub is asked only to confirm the installation exists. Ownership in *our*
 * database is exclusive: an installation already linked to another user is
 * never reassigned. Call this from the App setup callback after verifying the
 * anti-CSRF `state` cookie — not from a generic "list all installations" path.
 */
export async function claimGithubInstallation(
  userId: string,
  installationId: number,
): Promise<ResolvedInstallation> {
  if (!Number.isFinite(installationId) || installationId <= 0) {
    throw new InstallationClaimError('invalid');
  }

  const appClient = await getAppClient();
  let account: unknown;
  try {
    const { data } = await appClient.rest.apps.getInstallation({
      installation_id: installationId,
    });
    account = data.account;
  } catch (err) {
    if (isNotFoundError(err)) throw new InstallationClaimError('not_found');
    throw err;
  }

  const accountName = accountNameOf(account);
  const existing = await db.githubInstallation.findUnique({
    where: { installation_id: installationId },
    select: { user_id: true },
  });

  if (existing && existing.user_id !== userId) {
    throw new InstallationClaimError('conflict');
  }

  try {
    const row = await db.githubInstallation.upsert({
      where: { installation_id: installationId },
      update: { account_name: accountName },
      create: {
        installation_id: installationId,
        user_id: userId,
        account_name: accountName,
      },
    });

    return {
      installation_id: Number(row.installation_id),
      account_name: row.account_name,
    };
  } catch (err) {
    // Unique race: another user claimed the same installation_id first.
    const raced = await db.githubInstallation.findUnique({
      where: { installation_id: installationId },
      select: { user_id: true },
    });
    if (raced && raced.user_id !== userId) {
      throw new InstallationClaimError('conflict');
    }
    throw err;
  }
}

/**
 * Finds this GitHub user's personal-account App installation and binds it.
 *
 * GitHub does not send the App setup callback when repository access is
 * changed from Settings → Applications. Polling would stay empty forever
 * unless we look up `GET /users/{username}/installation` (JWT, this user
 * only — never `apps.listInstallations()`).
 */
export async function discoverAndClaimUserInstallation(
  userId: string,
  githubLogin: string | null | undefined,
): Promise<ResolvedInstallation | null> {
  const login = githubLogin?.trim();
  if (!login) return null;
  if (!env.githubAppId || !env.githubAppPrivateKey) return null;

  const appClient = await getAppClient();
  let installationId: number;
  let accountName: string;
  try {
    const { data } = await appClient.rest.apps.getUserInstallation({
      username: login,
    });
    installationId = data.id;
    accountName = accountNameOf(data.account);
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }

  if (accountName.toLowerCase() !== login.toLowerCase()) {
    return null;
  }

  try {
    return await claimGithubInstallation(userId, installationId);
  } catch (err) {
    if (err instanceof InstallationClaimError && err.code === 'conflict') {
      return null;
    }
    throw err;
  }
}

/**
 * Resolves the GitHub App installations that can act on behalf of a user.
 *
 * The database is the source of truth (rows written by the setup callback /
 * claim path). We never call `apps.listInstallations()` — that API returns
 * every install of the App and must not be associated with the current user.
 *
 * Live GitHub is used only to drop *this user's* rows whose installation has
 * been deleted, and to refresh account names. Network / credential failures
 * fall back to the cached rows so previously linked repos still resolve.
 */
export async function resolveCurrentInstallations(userId: string): Promise<ResolvedInstallation[]> {
  const cached = await db.githubInstallation.findMany({
    where: { user_id: userId },
    select: { id: true, installation_id: true, account_name: true },
  });

  const asResolved = (): ResolvedInstallation[] =>
    cached.map((row) => ({
      installation_id: Number(row.installation_id),
      account_name: row.account_name,
    }));

  try {
    if (!env.githubAppId || !env.githubAppPrivateKey) {
      return asResolved();
    }

    const appClient = await getAppClient();
    const resolved: ResolvedInstallation[] = [];

    for (const row of cached) {
      const installationId = Number(row.installation_id);
      try {
        const { data } = await appClient.rest.apps.getInstallation({
          installation_id: installationId,
        });
        const accountName = accountNameOf(data.account);
        if (accountName !== row.account_name) {
          await db.githubInstallation.updateMany({
            where: { id: row.id, user_id: userId },
            data: { account_name: accountName },
          });
        }
        resolved.push({ installation_id: installationId, account_name: accountName });
      } catch (err) {
        if (isNotFoundError(err)) {
          await db.githubInstallation.deleteMany({
            where: { id: row.id, user_id: userId },
          });
        } else {
          resolved.push({
            installation_id: installationId,
            account_name: row.account_name,
          });
        }
      }
    }

    return resolved;
  } catch (err) {
    console.warn('Could not reconcile installations from GitHub App, using cached rows:', err);
    return asResolved();
  }
}

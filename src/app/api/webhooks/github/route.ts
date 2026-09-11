import { NextResponse } from 'next/server';
import { Webhooks } from '@octokit/webhooks';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { indexRepository } from '@/features/github/indexer/github-client';


const webhooks = new Webhooks({
  secret: env.githubWebhookSecret,
});

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-hub-signature-256') || '';
    const id = request.headers.get('x-github-delivery') || '';
    const name = request.headers.get('x-github-event') || '';

    const bodyText = await request.text();

    const isVerified = await webhooks.verify(bodyText, signature);
    
    if (!isVerified) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    // Handle events
    if (name === 'installation') {
      if (payload.action === 'deleted') {
        const installationId = payload.installation.id;
        await db.githubInstallation.deleteMany({ where: { installation_id: installationId } });
        console.log(`[Webhook] Deleted installation ${installationId}`);
      }
    } else if (name === 'push') {
      // Incremental delta sync: automatically re-index repository
      const repoId = payload.repository?.id;
      const installationId = payload.installation?.id;

      if (repoId) {
        const repo = await db.repository.findUnique({
          where: { github_repo_id: repoId }
        });

        if (repo && installationId) {
          indexRepository(
            installationId,
            repo.id,
            repo.owner,
            repo.name,
            repo.default_branch || 'main'
          )
            .then(() => console.log(`[Webhook] Automatically indexed ${repo.name} after push`))
            .catch((err) => console.error(`[Webhook] Error indexing ${repo.name}:`, err));
        } else {
          await db.repository.updateMany({
            where: { github_repo_id: repoId },
            data: { last_synced: null }
          });
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


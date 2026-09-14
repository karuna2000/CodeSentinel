import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse, buildUnauthorizedResponse } from '@/lib/security';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';
import { WIKI_RATE_LIMIT, INPUT_LIMITS } from '@/config/app.config';
import crypto from 'crypto';

export async function POST(
  req: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return buildUnauthorizedResponse();
  }

  const params = await props.params;
  const { repoId } = params;
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await checkRateLimit(`wiki-promote:${userId}`, WIKI_RATE_LIMIT);
  if (!allowed) {
    logger.warn('[Wiki Promote]', `Rate limit hit for user ${userId}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  try {
    const { question, answer } = await req.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 },
      );
    }

    if (answer.length > INPUT_LIMITS.wikiAnswerMaxChars) {
      return NextResponse.json(
        { error: `Answer too long. Maximum is ${INPUT_LIMITS.wikiAnswerMaxChars} characters.` },
        { status: 400 },
      );
    }

    const repo = await db.repository.findFirst({
      where: { id: repoId, user_id: userId },
      select: { id: true, name: true, commit_sha: true },
    });
    if (!repo) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const slug = question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50);

    const title = question.length > 60 ? question.slice(0, 57) + '...' : question;
    let path = `FAQ/${slug}.md`;

    const markdownContent = `# ${title}

> [!NOTE]
> **Question:** ${question}

## Answer

${answer}

---

*Promoted from Chat · [${repo.name}](/dashboard/repos/${repoId}/wiki)*
`;

    const existing = await db.wikiPage.findFirst({
      where: { repo_id: repo.id, path },
    });

    if (existing) {
      const uniqueSlug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
      path = `FAQ/${uniqueSlug}.md`;
    }

    await db.wikiPage.create({
      data: {
        repo_id: repo.id,
        path,
        title,
        content: markdownContent,
        commit_sha: repo.commit_sha ?? null,
      },
    });

    logger.info('[Wiki Promote]', `Promoted Q&A to ${path}`, { userId, repoId });
    traceEvent('wiki_promote', { userId, repoId, path });

    return NextResponse.json({ success: true, path, title });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Wiki Promote]', 'Failed to promote to wiki', { error: message, repoId, userId });
    return NextResponse.json(
      { error: 'Failed to promote to wiki' },
      { status: 500 },
    );
  }
}

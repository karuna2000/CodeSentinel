import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';
import { WIKI_RATE_LIMIT, INPUT_LIMITS } from '@/config/app.config';

/** GET /api/github/repos/[repoId]/wiki/[...path] — returns a single wiki page */
export async function GET(
  request: Request,
  props: { params: Promise<{ repoId: string; path: string[] }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId, path: pathSegments } = params;
  const pagePath = pathSegments.join('/');

  const { allowed, retryAfterMs } = await checkRateLimit(`wiki:${session.user.id}`, WIKI_RATE_LIMIT);
  if (!allowed) {
    return buildRateLimitedResponse(retryAfterMs);
  }

  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: session.user.id },
    select: { id: true, commit_sha: true },
  });
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const page = await db.wikiPage.findUnique({
    where: { repo_id_path: { repo_id: repoId, path: pagePath } },
  });

  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const indexCommitSha = repo.commit_sha ?? null;
  const stale = indexCommitSha !== null && page.commit_sha !== indexCommitSha;

  return NextResponse.json({ ...page, stale, indexCommitSha });
}

/** PUT /api/github/repos/[repoId]/wiki/[...path] — updates a wiki page */
export async function PUT(
  request: Request,
  props: { params: Promise<{ repoId: string; path: string[] }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId, path: pathSegments } = params;
  const userId = session.user.id;
  const pagePath = pathSegments.join('/');

  const { allowed, retryAfterMs } = await checkRateLimit(`wiki-edit:${userId}`, WIKI_RATE_LIMIT);
  if (!allowed) {
    logger.warn('[Wiki Edit]', `Rate limit hit for user ${userId}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: userId },
    select: { id: true },
  });
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const page = await db.wikiPage.findUnique({
    where: { repo_id_path: { repo_id: repoId, path: pagePath } },
  });
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  let body: { content?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { content, title } = body;

  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  if (content.length > INPUT_LIMITS.wikiAnswerMaxChars) {
    return NextResponse.json(
      { error: `Content too long. Maximum is ${INPUT_LIMITS.wikiAnswerMaxChars} characters.` },
      { status: 400 },
    );
  }

  const updated = await db.wikiPage.update({
    where: { id: page.id },
    data: {
      content,
      ...(typeof title === 'string' && title.trim().length > 0 ? { title: title.trim() } : {}),
    },
  });

  logger.info('[Wiki Edit]', `Updated page ${pagePath}`, { userId, repoId });
  traceEvent('wiki_page_updated', { userId, repoId, path: pagePath });

  return NextResponse.json(updated);
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString } from '@/features/context-engine/services/budget-manager';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { INPUT_LIMITS } from '@/config/app.config';
import { classifyIntent } from '@/features/chat/agent/classify-intent';
import { buildInvestigationPlan } from '@/features/chat/agent/build-investigation-plan';

export async function POST(
  request: Request,
  props: { params: Promise<{ repoId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { repoId } = params;
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await checkRateLimit(`query:${userId}`);
  if (!allowed) {
    return buildRateLimitedResponse(retryAfterMs);
  }

  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: userId },
    select: { id: true },
  });
  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === 'string' ? body.query : '';
    if (!query.trim()) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }
    if (query.length > INPUT_LIMITS.queryMaxChars) {
      return NextResponse.json(
        { error: `Query too long. Maximum is ${INPUT_LIMITS.queryMaxChars} characters.` },
        { status: 400 },
      );
    }

    const classified = await classifyIntent(query, userId, repoId);
    const plan = buildInvestigationPlan(classified.intent, classified.directionHint);
    const rawContext = await retrieveContext(repoId, classified.searchTerms, query, {
      direction: plan.graph.enabled ? plan.graph.direction : 'both',
      maxHops: plan.graph.enabled ? plan.graph.maxHops : 0,
      relations: plan.graph.enabled ? plan.graph.relations : null,
      resultLimit: plan.resultLimit,
    });

    return NextResponse.json({
      success: true,
      intent: classified.intent,
      context_preview: formatContextString(rawContext),
      nodes_found: rawContext.nodes.length,
      edges_found: rawContext.edges.length,
    });
  } catch (error) {
    console.error('Error in Context Engine query:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

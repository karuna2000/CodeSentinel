import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  answerQuestion,
  buildChatResponse,
  extractTurnText,
  type ChatTurnInput,
} from '@/features/chat/services/chat-pipeline';
import { checkUsageBudget, buildUsageExceededResponse } from '@/lib/llm/metering';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { TelemetryEvent } from '@/lib/observability-events';
import { INPUT_LIMITS } from '@/config/app.config';

export const maxDuration = 60;

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

  const { allowed, retryAfterMs } = await checkRateLimit(`chat:${userId}`);
  if (!allowed) {
    logger.warn('[Chat]', `Rate limit hit for user ${userId}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  const budget = await checkUsageBudget(userId);
  if (!budget.allowed) {
    logger.warn('[Chat]', `Usage cap hit for user ${userId}`, {
      usedTokens: budget.usedTokens,
      capTokens: budget.capTokens,
    });
    return buildUsageExceededResponse(budget.usedTokens, budget.capTokens);
  }

  // Verify repo belongs to this user
  const repo = await db.repository.findFirst({
    where: { id: repoId, user_id: userId },
    select: { id: true, commit_sha: true },
  });
  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  try {
    const { messages } = (await request.json()) as { messages?: ChatTurnInput[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    const query = extractTurnText(latestMessage);
    if (!query.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    if (query.length > INPUT_LIMITS.chatMessageMaxChars) {
      return NextResponse.json(
        { error: `Message too long. Maximum is ${INPUT_LIMITS.chatMessageMaxChars} characters.` },
        { status: 400 }
      );
    }

    const history = messages
      .slice(0, -1)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: extractTurnText(m),
      }))
      .filter((m) => m.content.trim().length > 0);

    // Shared pipeline: retrieval → generation → guardrails → cache.
    const result = await answerQuestion({
      repoId,
      commitSha: repo.commit_sha,
      actorId: userId,
      query,
      history,
      useCache: true,
      persist: true,
    });

    return buildChatResponse(result.text, result.meta);
  } catch (error) {
    logger.error('[Chat]', 'Chat request failed', { 'event.name': TelemetryEvent.AgentQueryFailed, error: error instanceof Error ? error.message : String(error), repoId });
    return NextResponse.json(
      { error: 'There was a problem answering your question. Please try again.' },
      { status: 500 }
    );
  }
}

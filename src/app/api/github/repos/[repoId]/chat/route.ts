import { streamText } from 'ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString, buildEvidenceIndex } from '@/features/context-engine/services/budget-manager';
import { classifyIntent } from '@/features/chat/agent/classify-intent';
import { buildInvestigationPlan } from '@/features/chat/agent/build-investigation-plan';
import { buildChatSystemPrompt } from '@/features/chat/agent/prompts';
import type { AnswerStatus, ChatIntent } from '@/features/chat/agent/types';
import { withResilience } from '@/lib/llm/resilience';
import { checkUsageBudget, trackStreamUsage, buildUsageExceededResponse } from '@/lib/llm/metering';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { INPUT_LIMITS } from '@/config/app.config';

export const maxDuration = 60;

interface ChatTurn {
  role?: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

function extractText(msg: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (msg.parts && msg.parts.length > 0) {
    return msg.parts
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text!)
      .join('');
  }
  return msg.content ?? '';
}

/** Maps intent + the top retrieved symbol names to concrete next questions (§44). */
function buildFollowUps(intent: ChatIntent, topNames: string[], hasEvidence: boolean): string[] {
  const a = topNames[0] ?? 'this code';
  const b = topNames[1] ?? null;

  const generic: Array<string | null> = [
    hasEvidence ? `What could break if I change ${a}?` : null,
    hasEvidence ? `How does ${a} work end to end?` : null,
    b ? `How do ${a} and ${b} interact?` : null,
  ];

  const byIntent: Record<ChatIntent, string[]> = {
    locate: [`What does ${a} do?`, `Where is ${a} used?`],
    explain: [`What calls ${a}?`, `Where is ${a} used?`, `What could break if I change ${a}?`],
    trace_flow: [`Where does ${a} appear first?`, `What happens if ${a} fails?`],
    architecture: ['How does authentication work end to end?', 'Where is repository indexing implemented?', 'How does wiki generation work?'],
    dependency: [`Show direct callers of ${a}`, `What could break if I change ${a}?`],
    impact: [`Which tests cover ${a}?`, `Show direct callers of ${a}`],
    debug: [`Where does ${a} check for errors?`, `What returns an error in this repo?`],
    compare: [`What does ${a} do?`, b ? `How do ${a} and ${b} differ?` : `What does ${a} depend on?`],
  };

  return [...new Set(byIntent[intent].concat(generic.filter((x): x is string => Boolean(x))))].slice(0, 4);
}

function computeStatus(evidenceCount: number): AnswerStatus {
  if (evidenceCount === 0) return 'not_found';
  if (evidenceCount <= 1) return 'limited_evidence';
  return 'grounded';
}

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
    select: { id: true },
  });
  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  const startedAt = performance.now();

  try {
    const { messages } = (await request.json()) as { messages?: ChatTurn[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    const query = extractText(latestMessage);
    if (!query.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    if (query.length > INPUT_LIMITS.chatMessageMaxChars) {
      return NextResponse.json(
        { error: `Message too long. Maximum is ${INPUT_LIMITS.chatMessageMaxChars} characters.` },
        { status: 400 }
      );
    }

    // ── 1. Classify intent (deterministic hints + model fallback, safe default) ──
    const classified = await classifyIntent(query, userId, repoId);
    const plan = buildInvestigationPlan(classified.intent, classified.directionHint);

    // ── 2. Retrieval — plan-aware traversal (direction + relations + depth) ──
    const rawContext = await retrieveContext(repoId, classified.searchTerms, query, {
      direction: plan.graph.enabled ? plan.graph.direction : 'both',
      maxHops: plan.graph.enabled ? plan.graph.maxHops : 0,
      relations: plan.graph.enabled ? plan.graph.relations : null,
      resultLimit: plan.resultLimit,
    });

    // ── 3. Ground the answer: status + evidence index + prompt ──
    const evidenceCount = rawContext.nodes.length;
    const status = computeStatus(evidenceCount);
    const contextString = formatContextString(rawContext);
    const evidenceIndex = buildEvidenceIndex(rawContext.nodes);
    const citations = evidenceIndex.map((ev, idx) => ({
      id: ev.id,
      nodeId: rawContext.nodes[idx]?.id ?? ev.id,
      label: ev.filePath
        ? ev.startLine != null && ev.endLine != null
          ? `${ev.filePath}:${ev.startLine}-${ev.endLine}`
          : ev.filePath
        : ev.nodeName,
      filePath: ev.filePath,
      nodeName: ev.nodeName,
      startLine: ev.startLine,
      endLine: ev.endLine,
    }));
    const followUps = buildFollowUps(
      classified.intent,
      rawContext.nodes.filter((n) => n.type !== 'FILE').map((n) => n.name).slice(0, 2),
      evidenceCount > 0
    );

    const systemPrompt = buildChatSystemPrompt(classified.intent, contextString);

    // ── 4. Normalise conversation → {role, content} for the LLM ──
    const formattedMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: extractText(m),
      }))
      .filter((m) => m.content.trim().length > 0)
      .slice(-INPUT_LIMITS.chatHistoryMaxTurns);

    // ── 5. Stream — same fallback/backoff policy as review & wiki engines ──
    const result = await withResilience(
      (model) =>
        streamText({
          model,
          system: systemPrompt,
          messages: formattedMessages,
          temperature: 0.1,
          experimental_telemetry: {
            isEnabled: true,
            metadata: {
              userId,
              repoId,
              intent: classified.intent,
              status,
              nodesRetrieved: evidenceCount,
              lexicalHits: rawContext.stats?.lexicalHits ?? 0,
              semanticHits: rawContext.stats?.semanticHits ?? 0,
              graphExpanded: rawContext.stats?.graphExpanded ?? 0,
            },
          },
        }),
      'chat',
    );

    trackStreamUsage(result.usage, { userId, repoId, feature: 'chat' });

    // ── 6. Wrap stream so lazy provider failures surface mid-stream (never a
    //        silent truncated 200). Sentinel stripped by the client. ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error('[Chat] stream error:', err);
          controller.enqueue(encoder.encode(`\n\n[__STREAM_ERROR__]There was a problem finishing the answer. Please try again.`));
        } finally {
          controller.close();
        }
      },
      cancel() {
        // Provider stream pulled to completion already; nothing to abort.
      },
    });

    logger.info('[Chat]', 'answered', {
      userId,
      repoId,
      intent: classified.intent,
      status,
      evidenceCount,
      stats: rawContext.stats,
      retrievalMs: Math.round(performance.now() - startedAt),
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-chat-meta': Buffer.from(
          JSON.stringify({
            intent: classified.intent,
            status,
            evidence: citations,
            followUps,
            stats: rawContext.stats ?? { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
          })
        ).toString('base64'),
      },
    });
  } catch (error) {
    logger.error('[Chat]', 'Chat request failed', { error: error instanceof Error ? error.message : String(error), repoId });
    return NextResponse.json(
      { error: 'There was a problem answering your question. Please try again.' },
      { status: 500 }
    );
  }
}
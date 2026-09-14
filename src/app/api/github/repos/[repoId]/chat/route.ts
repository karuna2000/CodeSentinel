import { streamText } from 'ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString, buildEvidenceIndex } from '@/features/context-engine/services/budget-manager';
import { classifyIntent } from '@/features/chat/agent/classify-intent';
import { buildInvestigationPlan } from '@/features/chat/agent/build-investigation-plan';
import { buildChatSystemPrompt } from '@/features/chat/agent/prompts';
import type { AnswerStatus, ChatIntent } from '@/features/chat/agent/types';
import { BLOCKED_FALLBACK, runGuardrails } from '@/features/chat/services/guardrails';
import { judgeGroundedness } from '@/features/chat/services/groundedness-judge';
import {
  buildCacheKey,
  getCacheClient,
  getCachedAnswer,
  setCachedAnswer,
  type CachedAnswer,
} from '@/lib/cache/chat-cache';
import { withResilience } from '@/lib/llm/resilience';
import { checkUsageBudget, trackStreamUsage, buildUsageExceededResponse } from '@/lib/llm/metering';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';
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

interface ChatResponseMeta {
  intent: ChatIntent;
  status: AnswerStatus;
  evidence: unknown;
  followUps: string[];
  stats: unknown;
  blocked: boolean;
  gates: Array<{ gate: string; pass: boolean; detail: string }>;
}

/** Single response shape for fresh, cached, and blocked answers alike. */
function buildChatResponse(text: string, meta: ChatResponseMeta): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(text));
      } catch (err) {
        console.error('[Chat] stream error:', err);
        controller.enqueue(encoder.encode(`\n\n[__STREAM_ERROR__]There was a problem finishing the answer. Please try again.`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Buffered payload already produced; nothing to abort.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-chat-meta': Buffer.from(JSON.stringify(meta)).toString('base64'),
    },
  });
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
    select: { id: true, commit_sha: true },
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

    // ── 0. Answer cache — commit_sha-scoped key: identical questions served
    //        without spending tokens; re-indexes auto-invalidate. Hits skip
    //        the LLM entirely (no usage recorded — that IS the savings) and
    //        are traced for hit-rate observability. ──
    const cacheKey = buildCacheKey(repoId, repo.commit_sha, query);
    const cacheClient = await getCacheClient();
    const cached = await getCachedAnswer(cacheKey, cacheClient);
    if (cached) {
      traceEvent('chat_cache_hit', { userId, repoId, intent: cached.intent });
      logger.info('[Chat]', 'cache hit', {
        userId,
        repoId,
        intent: cached.intent,
        retrievalMs: Math.round(performance.now() - startedAt),
      });
      return buildChatResponse(cached.text, {
        intent: cached.intent as ChatIntent,
        status: cached.status as AnswerStatus,
        evidence: cached.evidence,
        followUps: cached.followUps,
        stats: cached.stats,
        blocked: false,
        gates: cached.gates,
      });
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

    // ── 6. Buffer-then-gate: collect the full answer, run the pure
    //        guardrails BEFORE any byte is sent, then stream the verdict.
    //        Buffering trades time-to-first-byte for blocking semantics —
    //        fail-closed output with an unchanged client contract (stream +
    //        sentinel + x-chat-meta). The slow model judge runs post-hoc
    //        (observability only, never blocking). ──
    const answer = await result.text;
    const verdict = runGuardrails(answer, {
      validTagIds: citations.map((c) => c.id),
      evidenceCount,
    });
    const servedText = verdict.blocked ? BLOCKED_FALLBACK : answer;
    const gates = verdict.results.map((r) => ({
      gate: r.gate,
      pass: r.pass,
      detail: r.detail,
    }));

    // Store cacheable answers: served, grounded, and cited. Blocked or thin
    // answers are never cached. Fire-and-forget — a Redis outage must not
    // slow or fail the response already in hand.
    if (!verdict.blocked && status === 'grounded') {
      const entry: CachedAnswer = {
        text: servedText,
        intent: classified.intent,
        status,
        evidence: citations,
        followUps,
        stats: rawContext.stats ?? { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
        gates,
      };
      void setCachedAnswer(cacheKey, entry, cacheClient).then((stored) => {
        traceEvent(stored ? 'chat_cache_store' : 'chat_cache_store_failed', {
          userId,
          repoId,
          intent: classified.intent,
        });
      });
    } else {
      traceEvent('chat_cache_skip', {
        userId,
        repoId,
        intent: classified.intent,
        reason: verdict.blocked ? 'blocked' : status,
      });
    }

    logger.info('[Chat]', 'answered', {
      userId,
      repoId,
      intent: classified.intent,
      status,
      evidenceCount,
      stats: rawContext.stats,
      blocked: verdict.blocked,
      gates,
      retrievalMs: Math.round(performance.now() - startedAt),
    });
    traceEvent('chat_gated', {
      userId,
      repoId,
      intent: classified.intent,
      status,
      blocked: verdict.blocked,
      gates,
    });

    // Post-hoc, fire-and-forget: judge groundedness + persist the exchange.
    // Persistence must never fail the request.
    void (async () => {
      try {
        const judged = verdict.blocked
          ? { pass: true, reason: 'blocked-no-judge', judged: false }
          : await judgeGroundedness(answer, contextString, { userId, repoId });
        traceEvent('chat_judged', {
          userId,
          repoId,
          pass: judged.pass,
          reason: judged.reason,
          judged: judged.judged,
        });
        await db.chatHistory.create({
          data: {
            user_id: userId,
            repo_id: repoId,
            query,
            answer: servedText,
            intent: classified.intent,
            status,
            evidence: citations,
            evals: {
              gates,
              judge: { pass: judged.pass, reason: judged.reason, judged: judged.judged },
              blocked: verdict.blocked,
            },
            blocked: verdict.blocked,
            latency_ms: Math.round(performance.now() - startedAt),
          },
        });
      } catch (err) {
        logger.error('[Chat]', 'Post-answer eval persistence failed', {
          error: err instanceof Error ? err.message : String(err),
          repoId,
        });
      }
    })();

    // Buffered text can't fail mid-stream server-side, but keep the sentinel
    // wrapper so the client contract is unchanged.
    return buildChatResponse(servedText, {
      intent: classified.intent,
      status,
      evidence: citations,
      followUps,
      stats: rawContext.stats ?? { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
      blocked: verdict.blocked,
      gates,
    });
  } catch (error) {
    logger.error('[Chat]', 'Chat request failed', { error: error instanceof Error ? error.message : String(error), repoId });
    return NextResponse.json(
      { error: 'There was a problem answering your question. Please try again.' },
      { status: 500 }
    );
  }
}
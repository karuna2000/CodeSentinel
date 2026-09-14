import { streamText } from 'ai';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import {
  formatContextString,
  buildEvidenceIndex,
} from '@/features/context-engine/services/budget-manager';
import { classifyIntent } from '@/features/chat/agent/classify-intent';
import { buildInvestigationPlan } from '@/features/chat/agent/build-investigation-plan';
import { buildChatSystemPrompt, CHAT_PROMPT_VERSION } from '@/features/chat/agent/prompts';
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
import { trackStreamUsage } from '@/lib/llm/metering';
import {
  cacheEventsTotal,
  chatAnswersTotal,
  chatLatencySeconds,
  guardrailBlocksTotal,
  judgeVerdictsTotal,
} from '@/lib/metrics';
import { withSpan } from '@/lib/tracing';
import { observabilityConfig } from '@/lib/observability-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { traceEvent } from '@/lib/observability';
import { INPUT_LIMITS } from '@/config/app.config';

/**
 * Shared answer pipeline (Phase D extraction).
 *
 * The authenticated chat route and the anonymous demo route run the same
 * retrieval → generation → guardrail → cache flow; they differ only in
 * access control (session ownership vs. allowlist) and accounting identity
 * (`actorId` is a user id, or `demo:{ip}` for anonymous traffic).
 */

export interface ChatTurnInput {
  role?: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

export function extractTurnText(msg: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (msg.parts && msg.parts.length > 0) {
    return msg.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text!)
      .join('');
  }
  return msg.content ?? '';
}

/** Maps intent + the top retrieved symbol names to concrete next questions (§44). */
export function buildFollowUps(intent: ChatIntent, topNames: string[], hasEvidence: boolean): string[] {
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

export function computeStatus(evidenceCount: number): AnswerStatus {
  if (evidenceCount === 0) return 'not_found';
  if (evidenceCount <= 1) return 'limited_evidence';
  return 'grounded';
}

export interface ChatResponseMeta {
  intent: ChatIntent;
  status: AnswerStatus;
  evidence: unknown;
  followUps: string[];
  stats: unknown;
  blocked: boolean;
  gates: Array<{ gate: string; pass: boolean; detail: string }>;
}

/** Single response shape for fresh, cached, and blocked answers alike. */
export function buildChatResponse(text: string, meta: ChatResponseMeta): Response {
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

export interface AnswerOptions {
  repoId: string;
  commitSha: string | null;
  /** Accounting identity: user id, or `demo:{ip}` for anonymous traffic. */
  actorId: string;
  query: string;
  /** Prior turns (oldest first), excluding the current query. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  useCache: boolean;
  persist: boolean;
}

export interface AnswerResult {
  text: string;
  meta: ChatResponseMeta;
}

export async function answerQuestion(opts: AnswerOptions): Promise<AnswerResult> {
  const { repoId, commitSha, actorId, query, history, useCache, persist } = opts;
  const startedAt = performance.now();

  // Root span: children (classify/retrieve/generate/gates/judge) correlate
  // automatically via context propagation (spec §9).
  return withSpan('chat.answer', { repoId, queryChars: query.length }, async (rootSpan) => {
    const otelTraceId = rootSpan.spanContext().traceId;

  // ── 0. Answer cache — commit_sha-scoped key. Hits skip the LLM entirely. ──
  const cacheKey = buildCacheKey(repoId, commitSha, query);
  const cacheClient = useCache ? await getCacheClient() : null;
  const cached = await getCachedAnswer(cacheKey, cacheClient);
  if (cached) {
    traceEvent('chat_cache_hit', { userId: actorId, repoId, intent: cached.intent });
    cacheEventsTotal.inc({ result: 'hit' });
    chatAnswersTotal.inc({ intent: cached.intent, status: cached.status, blocked: 'false' });
    chatLatencySeconds.observe((performance.now() - startedAt) / 1000);
    logger.info('[Chat]', 'cache hit', {
      userId: actorId,
      repoId,
      intent: cached.intent,
      retrievalMs: Math.round(performance.now() - startedAt),
    });
    return {
      text: cached.text,
      meta: {
        intent: cached.intent as ChatIntent,
        status: cached.status as AnswerStatus,
        evidence: cached.evidence,
        followUps: cached.followUps,
        stats: cached.stats,
        blocked: false,
        gates: cached.gates,
      },
    };
  }

  // ── 1. Classify intent (deterministic hints + model fallback, safe default) ──
  const classified = await withSpan(
    'chat.classify',
    { queryChars: query.length },
    async () => classifyIntent(query, actorId, repoId),
  );
  const plan = buildInvestigationPlan(classified.intent, classified.directionHint);

  // ── 2. Retrieval — plan-aware traversal (direction + relations + depth) ──
  const rawContext = await withSpan(
    'chat.retrieve',
    { intent: classified.intent, direction: plan.graph.direction, maxHops: plan.graph.maxHops },
    async (span) => {
      const ctx = await retrieveContext(repoId, classified.searchTerms, query, {
        direction: plan.graph.enabled ? plan.graph.direction : 'both',
        maxHops: plan.graph.enabled ? plan.graph.maxHops : 0,
        relations: plan.graph.enabled ? plan.graph.relations : null,
        resultLimit: plan.resultLimit,
      });
      span.setAttributes({
        'retrieval.nodes': ctx.nodes.length,
        'retrieval.lexicalHits': ctx.stats?.lexicalHits ?? 0,
        'retrieval.semanticHits': ctx.stats?.semanticHits ?? 0,
        'retrieval.graphExpanded': ctx.stats?.graphExpanded ?? 0,
      });
      return ctx;
    },
  );

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

  // ── 4. Conversation → {role, content}, current query appended last ──
  const formattedMessages = [...history, { role: 'user' as const, content: query }]
    .filter((m) => m.content.trim().length > 0)
    .slice(-INPUT_LIMITS.chatHistoryMaxTurns);

  // ── 5. Generate — span covers stream CONSUMPTION (call setup is instant
  //        in SDK v6; generation latency lives in the awaited text). ──
  const { result, answer } = await withSpan(
    'chat.generate',
    { intent: classified.intent, status, evidenceCount, promptVersion: CHAT_PROMPT_VERSION },
    async (span) => {
      const r = await withResilience(
        (model) =>
          streamText({
            model,
            system: systemPrompt,
            messages: formattedMessages,
            temperature: 0.1,
            experimental_telemetry: {
              isEnabled: observabilityConfig().enabled,
              recordInputs: observabilityConfig().capturePrompts,
              recordOutputs: observabilityConfig().captureCompletions,
              metadata: {
                userId: actorId,
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
      const text = await r.text;
      const usage = await r.usage;
      span.setAttributes({
        'llm.inputTokens': usage.inputTokens ?? 0,
        'llm.outputTokens': usage.outputTokens ?? 0,
        'llm.answerChars': text.length,
      });
      return { result: r, answer: text };
    },
  );

  trackStreamUsage(result.usage, { userId: actorId, repoId, feature: 'chat' });
  const verdict = await withSpan(
    'chat.gates',
    { intent: classified.intent, evidenceCount, answerChars: answer.length },
    async () =>
      runGuardrails(answer, {
        validTagIds: citations.map((c) => c.id),
        evidenceCount,
      }),
  );
  const servedText = verdict.blocked ? BLOCKED_FALLBACK : answer;
  const gates = verdict.results.map((r) => ({
    gate: r.gate,
    pass: r.pass,
    detail: r.detail,
  }));

  if (useCache) {
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
        cacheEventsTotal.inc({ result: stored ? 'store' : 'store_failed' });
        traceEvent(stored ? 'chat_cache_store' : 'chat_cache_store_failed', {
          userId: actorId,
          repoId,
          intent: classified.intent,
        });
      });
    } else {
      cacheEventsTotal.inc({ result: 'skip' });
      traceEvent('chat_cache_skip', {
        userId: actorId,
        repoId,
        intent: classified.intent,
        reason: verdict.blocked ? 'blocked' : status,
      });
    }
  }

  logger.info('[Chat]', 'answered', {
    userId: actorId,
    repoId,
    intent: classified.intent,
    status,
    evidenceCount,
    promptVersion: CHAT_PROMPT_VERSION,
    otelTraceId,
    stats: rawContext.stats,
    blocked: verdict.blocked,
    gates,
    retrievalMs: Math.round(performance.now() - startedAt),
  });
  chatAnswersTotal.inc({
    intent: classified.intent,
    status,
    blocked: String(verdict.blocked),
  });
  chatLatencySeconds.observe((performance.now() - startedAt) / 1000);
  for (const g of verdict.results) {
    if (!g.pass) guardrailBlocksTotal.inc({ gate: g.gate });
  }
  traceEvent('chat_gated', {
    userId: actorId,
    repoId,
    intent: classified.intent,
    status,
    blocked: verdict.blocked,
    gates,
    otel_trace_id: otelTraceId,
  });

  // Post-hoc, fire-and-forget: judge groundedness + persist the exchange.
  if (persist) {
    void (async () => {
      try {
        const judged = verdict.blocked
          ? { pass: true, reason: 'blocked-no-judge', judged: false }
          : await withSpan('chat.judge', { intent: classified.intent }, async (span) => {
              const v = await judgeGroundedness(answer, contextString, { userId: actorId, repoId });
              // Judge verdict as span attrs: the Langfuse-visible evaluation
              // record (spec §18), alongside the Prometheus counter + Postgres.
              span.setAttributes({ 'judge.pass': v.pass, 'judge.reason': v.reason, 'judge.ran': v.judged });
              return v;
            });
        judgeVerdictsTotal.inc({ pass: String(judged.pass) });
        traceEvent('chat_judged', {
          userId: actorId,
          repoId,
          pass: judged.pass,
          reason: judged.reason,
          judged: judged.judged,
        });
        await db.chatHistory.create({
          data: {
            user_id: actorId,
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
  }

  return {
    text: servedText,
    meta: {
      intent: classified.intent,
      status,
      evidence: citations,
      followUps,
      stats: rawContext.stats ?? { lexicalHits: 0, semanticHits: 0, graphExpanded: 0 },
      blocked: verdict.blocked,
      gates,
    },
  };
  });
}

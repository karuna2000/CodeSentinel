import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { runReasoningEngine } from '@/features/llm-reasoning';
import { runChatEngine } from '@/features/llm-reasoning/chat-engine';
import { getDefaultReasoningModel, getDefaultChatModel } from '@/lib/llm/provider';
import { checkRateLimit } from '@/lib/rate-limit';
import { enforceContentLength, buildUnauthorizedResponse, buildRateLimitedResponse } from '@/lib/security';
import { logger } from '@/lib/logger';
import { MAX_UPLOAD_BYTES } from '@/lib/config';
import { FindingCategorySchema, FindingSeveritySchema } from '@/types/llm-reasoning';

export const maxDuration = 60;

// ─── Review mode schema (existing) ───────────────────────────────────────────

const ReviewRequestBodySchema = z.object({
  mode: z.literal('review').optional(),
  content: z.string().min(1).max(MAX_UPLOAD_BYTES),
  task: z.string().optional(),
  correction: z.string().optional(),
  understanding: z.object({
    language: z.object({ name: z.string(), confidence: z.number() }),
    framework: z.object({ name: z.string() }).nullable(),
    runtime: z.object({ type: z.string() }).nullable(),
    artifactType: z.object({ type: z.string() }).nullable(),
    dependencies: z.array(z.string()),
    architecturalSignals: z.array(
      z.object({
        name: z.string(),
        evidence: z.string(),
      })
    ),
    overallConfidence: z.number(),
    requiresClarification: z.boolean(),
    clarificationQuestions: z.array(
      z.object({
        question: z.string(),
        reason: z.string(),
      })
    ),
    summary: z.string(),
    versionGrounding: z.unknown().nullable(),
  }),
});

// ─── Chat mode schema (new) ───────────────────────────────────────────────────

// v6 AI SDK sends messages as UIMessage objects with a `parts` array.
// Each text part has { type: 'text', text: string }.
const ChatMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

const ChatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  // v6 format: parts array
  parts: z.array(ChatMessagePartSchema).optional(),
  // legacy / direct format: plain content string (keep for backwards compat)
  content: z.string().optional(),
});

const ChatFindingContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.string(),
  explanation: z.string(),
  recommendation: z.string(),
  evidence: z.array(z.string()),
  codeSnippet: z.string().optional(),
});

const ChatRequestBodySchema = z.object({
  mode: z.literal('chat'),
  messages: z.array(ChatMessageSchema).min(1).max(50),
  findingContext: ChatFindingContextSchema.optional(),
});

/** Extracts plain text from a v6 UIMessage (parts) or legacy content field. */
function extractMessageText(msg: z.infer<typeof ChatMessageSchema>): string {
  if (msg.parts && msg.parts.length > 0) {
    return msg.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text!)
      .join('');
  }
  return msg.content ?? '';
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const contentLengthError = enforceContentLength(req);
  if (contentLengthError) return contentLengthError;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return buildUnauthorizedResponse();
  }

  const rateLimitKey = `reason:${session.user.id}`;
  const { allowed, remaining, retryAfterMs } = checkRateLimit(rateLimitKey);
  if (!allowed) {
    logger.warn('[API/Reasoning]', `Rate limit hit for user ${session.user.id}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  try {
    const rawBody = await req.json();

    // ── Branch on mode ──────────────────────────────────────────────────────

    if (rawBody?.mode === 'chat') {
      const parsed = ChatRequestBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        logger.warn('[API/Chat]', 'Invalid chat request body', parsed.error.flatten());
        return new Response(
          JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const { messages: rawMessages, findingContext } = parsed.data;
      const model = getDefaultChatModel();

      // Normalise v6 UIMessage → {role, content} that runChatEngine expects.
      // Filter out system messages and empty turns.
      const messages = rawMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: extractMessageText(m),
        }))
        .filter((m) => m.content.trim().length > 0);

      if (messages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid message content found' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      logger.info('[API/Chat]', `Follow-up chat request — ${messages.length} turns, finding: ${findingContext?.id ?? 'none'}`);

      const result = await runChatEngine(messages, findingContext, { model });
      return result.toTextStreamResponse();
    }

    // ── Default: review mode (existing behaviour) ───────────────────────────

    const parsed = ReviewRequestBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      logger.warn('[API/Reasoning]', 'Invalid request body', parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { understanding, content, task, correction } = parsed.data;
    const model = getDefaultReasoningModel();

    let combinedTask = task ? task : 'comprehensive code review';
    if (correction) {
      combinedTask = `CRITICAL INSTRUCTION FROM USER: Ignore previous detected context. The user explicitly states: "${correction}". \n\nAdditional instructions: ${combinedTask}`;
    }

    const result = await runReasoningEngine(understanding as any, content, {
      model,
      task: combinedTask,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    logger.error('[API/Reasoning]', 'Unhandled error', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

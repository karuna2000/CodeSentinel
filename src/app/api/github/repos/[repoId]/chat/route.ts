import { streamText, generateObject } from 'ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString, buildEvidenceIndex } from '@/features/context-engine/services/budget-manager';
import { withResilience } from '@/lib/llm/resilience';
import { checkUsageBudget, recordUsage, trackStreamUsage, buildUsageExceededResponse } from '@/lib/llm/metering';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildRateLimitedResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { INPUT_LIMITS } from '@/config/app.config';

export const maxDuration = 60;

interface ChatTurn {
  role?: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

const IntentSchema = z.object({
  intent: z.enum(['Exploratory', 'Data Flow', 'Locational', 'Schema']),
  search_terms: z.array(z.string()).describe('Keywords to search for in the codebase'),
});

async function detectQueryIntent(query: string, userId: string, repoId: string) {
  try {
    const object = await withResilience(
      (model) =>
        generateObject({
          model,
          schema: IntentSchema,
          system: `You are a codebase search assistant. Given a developer's question about a codebase,
extract the most relevant search_terms (unique nouns, function names, file names) to query a code index.
Omit stop words. Classify the intent type.`,
          prompt: query,
          temperature: 0,
        }),
      'intent-detect',
    );

    if (object.usage) {
      void recordUsage(
        { inputTokens: object.usage.inputTokens ?? 0, outputTokens: object.usage.outputTokens ?? 0 },
        { userId, repoId, feature: 'intent-detect' },
      ).catch((err: unknown) =>
        logger.error('[RepoChat]', 'Failed to record intent usage', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return object.object;
  } catch {
    return {
      intent: 'Exploratory' as const,
      search_terms: query.split(/\s+/).filter(w => w.length > 3),
    };
  }
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

  // Rate limit: 10 chat requests per minute per user
  const { allowed, retryAfterMs } = await checkRateLimit(`chat:${userId}`);
  if (!allowed) {
    logger.warn('[RepoChat]', `Rate limit hit for user ${userId}`);
    return buildRateLimitedResponse(retryAfterMs);
  }

  const budget = await checkUsageBudget(userId);
  if (!budget.allowed) {
    logger.warn('[RepoChat]', `Usage cap hit for user ${userId}`, {
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

    // Enforce max message length
    if (query.length > INPUT_LIMITS.chatMessageMaxChars) {
      return NextResponse.json(
        { error: `Message too long. Maximum is ${INPUT_LIMITS.chatMessageMaxChars} characters.` },
        { status: 400 }
      );
    }

    // 1. Detect Intent → search terms
    const intentResult = await detectQueryIntent(query, userId, repoId);

    // 2. Retrieve Context from DB (BM25 + semantic + graph traversal)
    const rawContext = await retrieveContext(repoId, intentResult.search_terms, query);

    // 3. Format Context into a prompt-friendly string
    const contextString = formatContextString(rawContext);

    // 4. Build System Prompt
    const systemPrompt = `You are an expert AI assistant helping a developer understand their codebase.
Use ONLY the following architectural context and code snippets to answer their question.
If the answer is not in the context, say so clearly, then provide a best-effort logical explanation.

${contextString}

When answering:
1. Reference specific file paths and function names from the context.
2. When referring to specific code from the context, cite its evidence tag inline (e.g. [E3]) so the developer can jump to the exact source.
3. Include short code examples where helpful.
4. Be concise but thorough.`;

    // 5. Normalise all messages → {role, content} for the LLM
    const formattedMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: extractText(m),
      }))
      .filter((m) => m.content.trim().length > 0);

    // 6. Stream response — same fallback/backoff policy as review & chat engines
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
              intent: intentResult.intent,
              nodesRetrieved: rawContext.nodes.length,
            },
          },
        }),
      'chat',
    );

    // 7. Grounded evidence → structured citation header ([E*] → file:line)
    //    matching the evidence tags embedded in the system prompt.
    const citations = buildEvidenceIndex(rawContext.nodes).map((ev) => ({
      id: ev.id,
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

    trackStreamUsage(result.usage, { userId, repoId, feature: 'chat' });

    // 7b. Wrap the text stream so lazy provider failures (which only surface
    //     mid-stream, after the 200 headers are already sent) are visibly
    //     reported to the client instead of a silent truncated 200. The sentinel
    //     is stripped from the assistant message by the client and shown as an error.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Stream generation failed';
          controller.enqueue(encoder.encode(`\n\n[__STREAM_ERROR__]${message}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-citations': Buffer.from(JSON.stringify(citations)).toString('base64'),
      },
    });

  } catch (error) {
    logger.error('[RepoChat]', 'Chat request failed', { error: error instanceof Error ? error.message : String(error), repoId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

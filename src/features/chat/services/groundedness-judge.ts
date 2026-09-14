import { z } from 'zod';
import { generateObject } from 'ai';
import { withResilience } from '@/lib/llm/resilience';
import { recordUsage } from '@/lib/llm/metering';
import { logger } from '@/lib/logger';

const JudgeSchema = z.object({
  pass: z.boolean().describe('True when every symbol/file in the answer appears in the context'),
  reason: z.string().describe('One sentence: which ungrounded symbol, or why it passes'),
});

export interface GroundednessVerdict {
  pass: boolean;
  reason: string;
  /** False when the judge itself errored — verdict is fail-open, not trusted. */
  judged: boolean;
}

/**
 * Model-judge groundedness check (spec §14). Slow (~1-2s), so it runs
 * POST-HOC fire-and-forget after the answer is served — it feeds
 * observability/persistence, never the blocking path. Fail-open: any judge
 * error returns pass=true with judged=false so infra trouble can't censor.
 */
export async function judgeGroundedness(
  answer: string,
  contextString: string,
  meta: { userId: string; repoId: string },
): Promise<GroundednessVerdict> {
  try {
    const object = await withResilience(
      (model) =>
        generateObject({
          model,
          schema: JudgeSchema,
          system:
            'You are a strict groundedness judge for CodeSentinel, a codebase Q&A assistant. ' +
            'Given the retrieved context chunks and the assistant answer, decide whether the ' +
            'answer mentions any function, class, file, or symbol NOT present in the context. ' +
            'Citations like [E1] are evidence markers, not claims — ignore them. ' +
            'Return pass=true only if every concrete code reference is grounded.',
          prompt: `Context:\n${contextString.slice(0, 6000)}\n\nAnswer:\n${answer.slice(0, 2000)}`,
          temperature: 0,
        }),
      'guardrail-judge',
    );

    if (object.usage) {
      void recordUsage(
        { inputTokens: object.usage.inputTokens ?? 0, outputTokens: object.usage.outputTokens ?? 0 },
        { userId: meta.userId, repoId: meta.repoId, feature: 'guardrail-judge' },
      ).catch((err: unknown) =>
        logger.error('[Chat][Judge]', 'Failed to record usage', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return { pass: object.object.pass, reason: object.object.reason, judged: true };
  } catch (err) {
    logger.warn('[Chat][Judge]', 'Groundedness judge failed, failing open', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { pass: true, reason: 'judge-unavailable', judged: false };
  }
}

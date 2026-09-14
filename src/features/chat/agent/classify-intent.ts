import { z } from 'zod';
import { generateObject } from 'ai';
import { withResilience } from '@/lib/llm/resilience';
import { recordUsage } from '@/lib/llm/metering';
import { logger } from '@/lib/logger';
import { sanitizeError } from '@/lib/observability-sanitize';
import type { ChatIntent, ClassifiedIntent, GraphDirection } from './types';

const IntentEnum = z.enum([
  'locate',
  'explain',
  'trace_flow',
  'architecture',
  'dependency',
  'impact',
  'debug',
  'compare',
]);

const IntentSchema = z.object({
  intent: IntentEnum,
  search_terms: z
    .array(z.string())
    .describe('Keywords (symbols, function names, file names, nouns) to search the code index for'),
  direction: z
    .enum(['incoming', 'outgoing', 'both'])
    .optional()
    .describe('For dependency/impact queries: incoming = callers/importers of the symbol, outgoing = callees/imports of the symbol'),
  confident: z.boolean().describe('False when the intent is genuinely ambiguous'),
});

/** Deterministic hint table (§16). Evaluated in priority order so that sharp
 *  intents (impact, compare, debug, dependency) win over weaker lookalikes. */
interface Hint {
  intent: ChatIntent;
  direction?: GraphDirection;
  patterns: RegExp[];
}

const HINTS: Hint[] = [
  {
    intent: 'compare',
    patterns: [/difference between/i, /\bdifference\b/i, /\bcompare\b/i, /\bvs\b/i, /\bversus\b/i, /how (do|does).*(compare|differ)/i, /what's the difference/i, /what is the difference/i],
  },
  {
    intent: 'impact',
    direction: 'incoming',
    patterns: [/what (could|would|might|will) break/i, /what depends on/i, /impact of/i, /if i change/i, /what .* need(s)? to update/i, /\bimpact\b/i, /affected by/i, /what would be affected/i, /what could be affected/i, /break if/i, /side effects of/i, /what else relies on/i],
  },
  {
    intent: 'debug',
    patterns: [/why (does|is|would|do|did)/i, /\b401\b/, /\b403\b/, /\b500\b/, /\bfail(ing|s|ure)?\b/i, /\berror\b/i, /\bstuck\b/i, /not working/i, /doesn'?t work/i, /would not work/i, /\bcrash(ing|es)?\b/i, /\bthrow(s)?\b/i, /return (an )?error/i, /verify$/, /is it (throwing|erroring)/i],
  },
  {
    intent: 'dependency',
    patterns: [/what (calls|uses|imports|invokes|references)/i, /who (calls|uses|imports|invokes)/i, /(callers|importers) of/i, /dependencies of/i, /(depends|dependency) on/i, /what does .* depend on/i, /where .* used/i, /usage of/i],
  },
  {
    intent: 'architecture',
    patterns: [/architecture/i, /structural/i, /structure of/i, /major modules/i, /subsystem/i, /how is (this|the) (repository|repo|project|codebase|backend|frontend) (structured|organized|laid out)/i, /organization of/i, /high.level overview/i, /top-level/i, /\bmodules?\b.*\boverview/i],
  },
  {
    intent: 'trace_flow',
    direction: 'both',
    patterns: [/how does .* work/i, /how (do|is|are)/i, /what happens (when|after|if)/i, /\bflow(s)?\b/i, /\btrace\b/i, /end[-\s]to[-\s]end/i, /from start to finish/i, /walk me through/i, /step by step/i, /\bpipeline\b/i, /sequence of/i, /lifecycle/i, /journey of/i],
  },
  {
    intent: 'locate',
    patterns: [/where (is|are|can i find)/i, /which file/i, /which module/i, /which class defines/i, /which (folder|directory|path)/i, /i? ?find(s)? the implementation of/i, /implemented in/i, /what file/i, /definition of/i, /search for/i, /\bfind\b/i, /where in the code/i],
  },
  {
    intent: 'explain',
    // Note: "how does X work" is intentionally NOT here — it matches the
    // trace_flow table above first and is remapped there, so the plan follows
    // the execution path instead of explaining a symbol at rest.
    patterns: [/what does/i, /explain/i, /what is/i, /what (did|do|are) (this|that|these|those)/i, /describe/i, /what does .* (do|return|produce)/i, /what's this/i, /can you (tell|explain|walk) me about/i, /what is the purpose/i, /meaning of/i],
  },
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'does', 'do', 'did', 'how', 'what',
  'where', 'which', 'who', 'why', 'when', 'this', 'that', 'these', 'those', 'of',
  'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'but', 'not', 'can', 'could',
  'would', 'should', 'will', 'explain', 'tell', 'show', 'work', 'works',
  'working', 'code', 'codebase', 'repository', 'repo', 'i', 'me', 'you', 'it', 'implementation',
]);

function extractSearchTerms(query: string): string[] {
  const tokens = query
    .replace(/[?!.,;:'"()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t.toLowerCase()));

  // Prefer identifiers/symbol-like tokens (camelCase, PascalCase, snake_case, dots)
  const symbolLike = tokens.filter((t) => /[A-Z_]/.test(t) || t.includes('.') || t.includes('('));
  const pool = symbolLike.length > 0 ? symbolLike : tokens;

  // De-duplicate case-insensitively, cap at 8 terms.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of pool) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t.replace(/[()]/g, ''));
    }
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Pure deterministic classification from the regex hint table (§16). Returns a
 * classified intent plus direction hint, or `null` when no hint matches (the
 * caller then falls back to the model).
 */
export function classifyByHints(query: string): Pick<ClassifiedIntent, 'intent' | 'directionHint' | 'confident'> | null {
  for (const hint of HINTS) {
    if (hint.patterns.some((re) => re.test(query))) {
      // "how does X work" also matches explain's "how does X work" pattern —
      // prefer trace_flow so the top-level plan follows the execution path.
      const intent: ChatIntent = hint.intent === 'explain' && /how does .* work/i.test(query)
        ? 'trace_flow'
        : hint.intent;

      let directionHint: GraphDirection | undefined = hint.direction;
      if (intent === 'impact') {
        directionHint = 'incoming';
      } else if (intent === 'dependency') {
        directionHint = /what does .* depend on/i.test(query) || /dependencies of/i.test(query)
          ? 'outgoing'
          : 'incoming';
      }

      return { intent, directionHint, confident: true };
    }
  }
  return null;
}

/**
 * Deterministic-lookahead classification (§16): quick regex hints first, and
 * only when they are inconclusive do we ask the model. Any ambiguity falls back
 * safely to `explain` so the answer stays conservative.
 */
export async function classifyIntent(
  query: string,
  userId: string,
  repoId: string
): Promise<ClassifiedIntent> {
  const searchTerms = extractSearchTerms(query);

  const hinted = classifyByHints(query);
  if (hinted) {
    return { ...hinted, searchTerms };
  }

  // No deterministic hit — ask the model, defaulting to explain on any failure.
  try {
    const object = await withResilience(
      (model) =>
        generateObject({
          model,
          schema: IntentSchema,
          system: `You are the intent classifier for CodeSentinel, a repository-understanding assistant.
Classify a developer's question about THEIR OWN codebase into exactly one intent:

- locate: "Where is X implemented?" — finding a symbol/site
- explain: "What does retrieveContext() do?" — explaining a symbol/flow at rest
- trace_flow: "How does authentication work end to end?" — an execution path
- architecture: "How is this repo structured? What are the major modules?"
- dependency: "What calls X? / What does this module depend on?"
- impact: "What could break if I change X? / What depends on this?"
- debug: "Why does this request return 401?" — cause/error analysis
- compare: "Difference between X and Y?"

Rules:
- If OVERWHELMINGLY obvious, confident=true. Otherwise confident=false and choose the most useful intent (default explain).
- Extract concrete search_terms: exact symbols, function names, file paths, or specific nouns.
- For dependency/impact set direction: impact = incoming (callers/importers); dependency = "what does X depend on" = outgoing, "what calls/uses X" = incoming.`,
          prompt: query,
          temperature: 0,
        }),
      'intent-detect'
    );

    if (object.usage) {
      void recordUsage(
        { inputTokens: object.usage.inputTokens ?? 0, outputTokens: object.usage.outputTokens ?? 0 },
        { userId, repoId, feature: 'intent-detect' }
      ).catch((err: unknown) =>
        logger.error('[Chat][Intent]', 'Failed to record usage', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    const { intent, confident } = object.object;
    if (confident) {
      return {
        intent: intent as ChatIntent,
        searchTerms: object.object.search_terms.length > 0
          ? object.object.search_terms.slice(0, 8)
          : searchTerms,
        directionHint: (object.object.direction as GraphDirection | undefined) ?? undefined,
        confident: true,
      };
    }
    return { intent: intent as ChatIntent, searchTerms, confident: false };
  } catch (err) {
    logger.warn('[Chat][Intent]', 'Model intent classification failed, defaulting to explain', {
      error: sanitizeError(err),
    });
    return { intent: 'explain', searchTerms, confident: false };
  }
}
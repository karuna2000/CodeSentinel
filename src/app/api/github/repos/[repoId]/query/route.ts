import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateObject } from 'ai';
import { z } from 'zod';
import { withResilience } from '@/lib/llm/resilience';
import { retrieveContext } from '@/features/context-engine/services/hybrid-retriever';
import { formatContextString } from '@/features/context-engine/services/budget-manager';
import { logger } from '@/lib/logger';

const IntentSchema = z.object({
  intent: z.enum(['Exploratory', 'Data Flow', 'Locational', 'Schema']),
  diagram_type: z.enum(['sequence', 'flowchart', 'er', 'none']),
  search_terms: z.array(z.string()).describe('List of keywords to search for in the codebase'),
});

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

  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    // 1. Detect Intent (resilient — same path as chat; no hardcoded model)
    let intentResult: z.infer<typeof IntentSchema> = {
      intent: 'Exploratory',
      diagram_type: 'none',
      search_terms: query.split(/\s+/).filter((w: string) => w.length > 3),
    };
    try {
      const object = await withResilience(
        (model) =>
          generateObject({
            model,
            schema: IntentSchema,
            system: `You are a codebase search assistant. Classify the user's codebase query into an intent
(Exploratory, Data Flow, Locational, Schema) and extract relevant search_terms (unique nouns, function
names, file names). Omit stop words.`,
            prompt: query,
            temperature: 0,
          }),
        'intent-detect',
      );
      intentResult = object.object;
    } catch (err) {
      logger.warn('[Query]', 'Intent detection failed, using fallback terms', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Retrieve Context (RRF + graph traversal, evidence-tagged)
    const rawContext = await retrieveContext(repoId, intentResult.search_terms, query);

    // 3. Format Context
    const contextString = formatContextString(rawContext);

    return NextResponse.json({
      success: true,
      intent: intentResult,
      context_preview: contextString,
      nodes_found: rawContext.nodes.length,
      edges_found: rawContext.edges.length,
    });

  } catch (error) {
    console.error('Error in Context Engine query:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

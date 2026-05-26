import { runReasoningEngine } from '@/features/llm-reasoning';
import { getDefaultReasoningModel } from '@/lib/llm/provider';
import type { CodeUnderstandingOutput } from '@/types/code-understanding';

export const maxDuration = 60; // Allow longer execution for LLM

export async function POST(req: Request) {
  try {
    const { understanding, content } = await req.json() as { 
      understanding: CodeUnderstandingOutput; 
      content: string 
    };

    if (!understanding || !content) {
      return new Response(JSON.stringify({ error: 'Missing understanding or content payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const model = getDefaultReasoningModel();
    
    // Call the reasoning engine to get a StreamObjectResult
    const result = await runReasoningEngine(understanding, content, {
      model,
      task: 'comprehensive code review',
    });

    // Pipe the stream back to the client
    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('[API/Reasoning] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

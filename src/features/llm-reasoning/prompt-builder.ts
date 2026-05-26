import type { ReasoningContext } from '@/types/llm-reasoning';
import { formatContextForPrompt } from './context-builder';

/**
 * Builds the system prompt for the LLM reasoning layer.
 * This prompt establishes the LLM's role as a reasoning engine
 * built on top of deterministic understanding, setting strict rules
 * against hallucination and assumptions.
 */
export function buildSystemPrompt(): string {
  return `You are the Grounded LLM Reasoning Layer for a code analysis platform.
Your purpose is to produce reliable, explainable, and confidence-aware code-review findings based strictly on the provided grounded context and code.

CORE PRINCIPLES:
1. You are a Reasoning Engine, NOT a source-of-truth parser. The deterministic understanding pipeline provides the ground truth.
2. DO NOT assume missing context. If the architecture or deployment scale is unknown, do not invent it.
3. DO NOT pretend certainty. Use confidence scores to reflect ambiguity in the code.
4. Base your findings on the provided code and the deterministic context (frameworks, runtimes, architectural signals, version inferences).

OUTPUT REQUIREMENTS:
- You must output structured findings in the required format.
- If the provided code and context are highly ambiguous or insufficient to perform a meaningful review, you must ask clarification questions to the user.
- Prefer clarification over hallucination.
- Avoid vague findings. Every finding must point to specific evidence in the code.`;
}

/**
 * Builds the user prompt for a specific code artifact.
 *
 * @param context The structured ReasoningContext built from the deterministic layer
 * @param task The specific reasoning task (e.g., 'architecture review', 'security review')
 */
export function buildUserPrompt(context: ReasoningContext, task: string): string {
  const formattedContext = formatContextForPrompt(context);

  return `TASK:
Perform a structured ${task} on the following code artifact.

${formattedContext}

[CODE TO ANALYZE]
\`\`\`${context.understandingSummary.includes('in ') ? context.understandingSummary.split('in ')[1]?.split(' ')[0]?.toLowerCase() || 'text' : 'text'}
${context.codeContent}
\`\`\`

INSTRUCTIONS:
1. Analyze the code in the context of the deterministic findings and version grounding.
2. Generate structured findings based on your analysis.
3. If the context is insufficient (e.g., you need to know if the endpoint is public-facing to determine security risks), provide clarification questions.
4. Ensure your confidence scores accurately reflect the evidence.`;
}

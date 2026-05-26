import type { CodeUnderstandingOutput } from '@/types/code-understanding';
import type { ReasoningContext } from '@/types/llm-reasoning';

/**
 * Builds the structured context provided to the LLM for reasoning.
 * This function extracts key signals from the deterministic understanding
 * and version grounding layers, avoiding sending excessive raw data.
 *
 * @param understanding The output from the Code Understanding Agent (which includes versionGrounding)
 * @param content The raw code content to analyze
 * @returns A structured ReasoningContext object
 */
export function buildReasoningContext(
  understanding: CodeUnderstandingOutput,
  content: string
): ReasoningContext {
  const versionInferences: string[] = [];
  const apiPatterns: string[] = [];
  const groundingSources: string[] = [];

  if (understanding.versionGrounding) {
    // Extract version inferences
    for (const fw of understanding.versionGrounding.frameworks) {
      if (fw.versionInference.label) {
        versionInferences.push(`${fw.framework}: ${fw.versionInference.label}`);
      }
    }

    // Extract API patterns
    for (const pattern of understanding.versionGrounding.detectedApiPatterns) {
      const deprecation = pattern.deprecatedInVersion ? ` (DEPRECATED in ${pattern.deprecatedInVersion})` : '';
      apiPatterns.push(`[${pattern.framework}] ${pattern.api} (Introduced: ${pattern.introducedInVersion})${deprecation} - ${pattern.description}`);
    }

    // Extract grounding sources
    for (const source of understanding.versionGrounding.groundingSources) {
      groundingSources.push(`${source.label} - ${source.url} (${source.purpose})`);
    }
  }

  return {
    understandingSummary: understanding.summary,
    framework: understanding.framework?.name ?? null,
    runtime: understanding.runtime?.type ?? null,
    artifactType: understanding.artifactType?.type ?? null,
    dependencies: understanding.dependencies,
    architecturalSignals: understanding.architecturalSignals.map(s => `${s.name} (Evidence: ${s.evidence})`),
    versionInferences,
    apiPatterns,
    groundingSources,
    codeContent: content,
  };
}

/**
 * Formats the ReasoningContext into a readable string for inclusion in the LLM prompt.
 */
export function formatContextForPrompt(context: ReasoningContext): string {
  return `[DETERMINISTIC UNDERSTANDING]
Summary: ${context.understandingSummary}
Framework: ${context.framework ?? 'None/Unknown'}
Runtime: ${context.runtime ?? 'Unknown'}
Artifact Type: ${context.artifactType ?? 'Unknown'}
Dependencies: ${context.dependencies.length > 0 ? context.dependencies.join(', ') : 'None'}

[ARCHITECTURAL SIGNALS]
${context.architecturalSignals.length > 0 ? context.architecturalSignals.join('\n') : 'None'}

[VERSION GROUNDING]
Inferred Versions:
${context.versionInferences.length > 0 ? context.versionInferences.map(v => '- ' + v).join('\n') : '- None'}

Detected API Patterns:
${context.apiPatterns.length > 0 ? context.apiPatterns.map(p => '- ' + p).join('\n') : '- None'}

Recommended Grounding Sources (for reference context):
${context.groundingSources.length > 0 ? context.groundingSources.map(s => '- ' + s).join('\n') : '- None'}`;
}

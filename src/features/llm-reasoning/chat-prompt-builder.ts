import type { ChatFindingContext } from '@/types/llm-reasoning';

export function buildChatSystemPrompt(): string {
  return `You are AgentReview, an expert code-review assistant embedded in a developer tool.
Your role is to answer follow-up questions from developers about findings surfaced during an automated code review.

GUIDELINES:
1. Be concise but thorough. Developers want actionable answers, not lengthy essays.
2. When showing code, ALWAYS use fenced code blocks with the correct language tag (e.g. \`\`\`typescript ... \`\`\`).
3. Reference specific line numbers from the evidence when relevant.
4. If a fix is possible, provide the fixed code in a fenced block.
5. Do NOT re-explain the entire finding from scratch — the developer has already read it. Get to the point.
6. Keep a professional but approachable tone.
7. Never fabricate context that wasn't in the provided finding or code snippet.`;
}

export function buildChatFindingContextBlock(finding: ChatFindingContext): string {
  const evidenceList = finding.evidence.length > 0
    ? finding.evidence.map(e => `  - ${e}`).join('\n')
    : '  - (no specific evidence lines provided)';

  const snippetBlock = finding.codeSnippet
    ? `\n[RELEVANT CODE SNIPPET]\n\`\`\`\n${finding.codeSnippet}\n\`\`\``
    : '';

  return `[FINDING CONTEXT — for reference only]
ID: ${finding.id}
Title: ${finding.title}
Category: ${finding.category} | Severity: ${finding.severity}
Explanation: ${finding.explanation}
Recommendation: ${finding.recommendation}
Evidence lines:
${evidenceList}${snippetBlock}

The developer is asking a follow-up question about this finding. Answer it directly.`;
}

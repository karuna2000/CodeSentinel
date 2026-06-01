import type { CodeLine } from '@/types/audit';

export function extractLineFromEvidence(
  evidence: string[],
  codeLines: CodeLine[],
): number | null {
  for (const ev of evidence) {
    const lineMatch = ev.match(/(?:line|L)\s*(\d+)/i) ?? ev.match(/^(\d+)$/);
    if (lineMatch) {
      return parseInt(lineMatch[1], 10);
    }
  }

  if (codeLines.length > 0) {
    for (const ev of evidence) {
      if (ev.length > 5) {
        const matchedLine = codeLines.find((l) => {
          const normCode = l.code
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .toLowerCase();
          return normCode.includes(ev.toLowerCase());
        });
        if (matchedLine) {
          return matchedLine.num;
        }
      }
    }
  }

  return null;
}

export function buildCodeSnippet(
  foundLine: number | null,
  evidence: string[],
  codeLines: CodeLine[],
): string {
  if (foundLine && codeLines.length > 0) {
    const idx = codeLines.findIndex((l) => l.num === foundLine);
    if (idx !== -1) {
      const startIdx = Math.max(0, idx - 1);
      const endIdx = Math.min(codeLines.length - 1, idx + 1);
      return codeLines
        .slice(startIdx, endIdx + 1)
        .map((l) =>
          l.code
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'"),
        )
        .join('\n');
    }
  }

  return evidence.length > 0 ? evidence.join('\n') : '';
}

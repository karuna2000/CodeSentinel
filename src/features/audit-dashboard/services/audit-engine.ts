/**
 * Audit Engine — converts an InputPayload into a ProcessingResult.
 *
 * This is the central processing dispatcher. In the initial implementation
 * it performs structural parsing (line extraction, metadata derivation).
 * Future stages will plug in AI-powered finding annotations here.
 *
 * Design principles:
 * - Pure function (no side-effects, no UI coupling)
 * - Synchronous (async orchestration happens in the hook/store layer)
 * - Scalable: ready for multi-file and enrichment stages
 */

import type { InputPayload, ProcessingResult, CodeLine, CodePin } from '@/types/audit';
import { formatByteSize } from '../utils/payload-scrubber';

/**
 * Escapes HTML special characters in a code line string so it is safe
 * to render via dangerouslySetInnerHTML in code panels.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts raw multi-line content into an array of CodeLine objects
 * suitable for CodePanel / UploadBubble rendering.
 *
 * @param content The raw text content to parse
 */
function parseCodeLines(content: string): CodeLine[] {
  // Split by both \r\n and \n to handle Windows-style line endings
  const rawLines = content.split(/\r?\n/);

  return rawLines.map((raw, index) => ({
    num: index + 1,
    code: escapeHtml(raw),
  }));
}

/**
 * Processes a validated InputPayload and returns a ProcessingResult.
 *
 * @param payload The normalised, validated input payload
 * @returns       A ProcessingResult with codeLines, empty pins (AI stage pending),
 *                and formatted metadata
 */
export function processPayload(payload: InputPayload): ProcessingResult {
  const codeLines = parseCodeLines(payload.content);

  // Pins are intentionally empty in the initial pipeline.
  // A future AI enrichment stage will populate these with real findings.
  const pins: Record<number, CodePin> = {};

  return {
    payload,
    codeLines,
    pins,
    formattedSize: formatByteSize(payload.byteSize),
  };
}

/**
 * Shared InputArtifact model — canonical internal representation for ALL input sources.
 *
 * Both uploaded files and pasted code normalise into this structure before
 * entering any rendering or processing stage. This is the single source of
 * truth for the unified preview system.
 */

import type { ProcessingResult } from './audit';

export type ArtifactSource = 'upload' | 'paste';

/** The canonical artifact representation consumed by InputArtifactCard */
export interface InputArtifact {
  /** Stable unique ID for React key usage */
  id: string;
  /** Where the content came from */
  source: ArtifactSource;
  /** Real filename (uploads) or virtual filename (pastes, e.g. "pasted-input.tsx") */
  filename: string;
  /** Human-readable language label (e.g. "TypeScript") */
  language: string;
  /** Raw text content */
  content: string;
  /** Size in bytes */
  byteSize: number;
  /** Total line count */
  lineCount: number;
  /** Human-readable size string (e.g. "1.2 KB") */
  formattedSize: string;
  /** ISO creation timestamp */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Converts a ProcessingResult (from the audit engine) into an InputArtifact.
 * Used for both uploaded files and normalised paste payloads.
 */
export function artifactFromProcessingResult(
  result: ProcessingResult,
  source: ArtifactSource,
): InputArtifact {
  return {
    id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source,
    filename: result.payload.filename,
    language: result.payload.language,
    content: result.payload.content,
    byteSize: result.payload.byteSize,
    lineCount: result.payload.lineCount,
    formattedSize: result.formattedSize,
    createdAt: result.payload.ingestedAt,
  };
}

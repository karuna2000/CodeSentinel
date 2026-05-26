/**
 * Shared audit/ingestion types for the real input-processing pipeline.
 */

import type { CodeUnderstandingOutput } from './code-understanding';
import type { ReasoningOutput } from './llm-reasoning';

/** Source of the ingested input */
export type InputSource = 'file-upload' | 'paste' | 'text-input';

/** A normalised, validated payload ready for downstream processing */
export interface InputPayload {
  /** Original filename (e.g. "auth.service.ts") or a synthetic label for pastes */
  filename: string;
  /** Raw text content of the uploaded/pasted code */
  content: string;
  /** Detected/derived programming language label (e.g. "TypeScript") */
  language: string;
  /** File extension including dot (e.g. ".ts") or empty string for pastes */
  extension: string;
  /** Total number of lines in the content */
  lineCount: number;
  /** Size in bytes */
  byteSize: number;
  /** Where the input came from */
  source: InputSource;
  /** ISO timestamp when the payload was ingested */
  ingestedAt: string;
}

/** A single rendered code line for display */
export interface CodeLine {
  num: number;
  code: string;
}

/** A flagged line annotation (future: populated by AI) */
export interface CodePin {
  severity: 'critical' | 'high' | 'medium' | 'low';
  id: string;
}

/**
 * The result of running the audit engine over an InputPayload.
 * Intentionally lightweight for the initial pipeline — AI enrichment
 * will add findings in a future processing stage.
 */
export interface ProcessingResult {
  payload: InputPayload;
  /** Code lines formatted for CodePanel / UploadBubble rendering */
  codeLines: CodeLine[];
  /** Line → finding annotations (empty until AI stage runs) */
  pins: Record<number, CodePin>;
  /** Human-readable file size string, e.g. "1.2 KB" */
  formattedSize: string;
  /**
   * Structured output from the Code Understanding Agent.
   * Populated after the understanding pipeline runs.
   * Null when the agent was not yet executed (e.g. during initial parse).
   */
  codeUnderstanding: CodeUnderstandingOutput | null;
  /**
   * Structured findings from the LLM Reasoning Layer.
   * Populated asynchronously after the understanding pipeline runs.
   * Null when the reasoning stage has not yet executed.
   */
  reasoning: ReasoningOutput | null;
}

/** Processing lifecycle state */
export type ProcessingState = 'idle' | 'reading' | 'normalizing' | 'understanding' | 'grounding' | 'reasoning' | 'done' | 'error';

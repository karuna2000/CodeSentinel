

import type { CodeUnderstandingOutput } from './code-understanding';
import type { ReasoningOutput } from './llm-reasoning';

export type InputSource = 'file-upload' | 'paste' | 'text-input';

export interface InputPayload {
  
  filename: string;
  
  content: string;
  
  language: string;
  
  extension: string;
  
  lineCount: number;
  
  byteSize: number;
  
  source: InputSource;
  
  ingestedAt: string;

  userContext?: string;
  userCorrection?: string;
}

export interface CodeLine {
  num: number;
  code: string;
}

export interface CodePin {
  severity: 'critical' | 'high' | 'medium' | 'low';
  id: string;
}

export interface ProcessingResult {
  payload: InputPayload;
  
  codeLines: CodeLine[];
  
  pins: Record<number, CodePin>;
  
  formattedSize: string;
  

  codeUnderstanding: CodeUnderstandingOutput | null;
  

  reasoning: ReasoningOutput | null;
}

export type ProcessingState = 'idle' | 'reading' | 'normalizing' | 'understanding' | 'grounding' | 'reasoning' | 'done' | 'error';

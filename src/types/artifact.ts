

import type { ProcessingResult } from './audit';

export type ArtifactSource = 'upload' | 'paste';

export interface InputArtifact {
  
  id: string;
  
  source: ArtifactSource;
  
  filename: string;
  
  language: string;
  
  content: string;
  
  byteSize: number;
  
  lineCount: number;
  
  formattedSize: string;
  
  createdAt: string;
}

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

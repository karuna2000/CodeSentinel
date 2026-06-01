

import type { VersionGroundingOutput } from './version-grounding';

export interface LanguageDetection {
  
  name: string;
  
  confidence: number;
  
  detectedVia: 'extension' | 'syntax-heuristic' | 'shebang' | 'keyword' | 'fallback';
}

export interface FrameworkDetection {
  
  name: string;
  
  confidence: number;
  
  signals: string[];
}

export interface RuntimeDetection {
  

  type: string;
  
  confidence: number;
  
  signals: string[];
}

export interface ArtifactTypeDetection {
  

  type: string;
  
  confidence: number;
}

export type ArchitecturalSignalName =
  | 'authentication'
  | 'database'
  | 'caching'
  | 'middleware'
  | 'async-boundary'
  | 'api-call'
  | 'state-management'
  | 'env-variable'
  | 'websocket'
  | 'filesystem-access'
  | 'error-handling'
  | 'logging'
  | 'rate-limiting'
  | 'cors'
  | 'encryption';

export interface ArchitecturalSignal {
  name: ArchitecturalSignalName;
  
  evidence: string;
}

export interface ClarificationQuestion {
  
  question: string;
  

  reason: string;
}

export interface CodeUnderstandingOutput {
  
  language: LanguageDetection;

  

  framework: FrameworkDetection | null;

  

  runtime: RuntimeDetection | null;

  

  artifactType: ArtifactTypeDetection | null;

  

  dependencies: string[];

  

  architecturalSignals: ArchitecturalSignal[];

  

  overallConfidence: number;

  

  requiresClarification: boolean;

  

  clarificationQuestions: ClarificationQuestion[];

  

  summary: string;

  

  versionGrounding: VersionGroundingOutput | null;
}

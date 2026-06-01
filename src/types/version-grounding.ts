

export interface VersionInference {
  

  minVersion: string | null;

  

  maxVersion: string | null;

  

  label: string;

  
  confidence: number;

  

  signals: string[];
}

export interface ApiPatternMatch {
  
  api: string;
  
  framework: string;
  
  introducedInVersion: string;
  
  description: string;
  

  deprecatedInVersion: string | null;
}

export interface GroundingSource {
  
  label: string;
  
  url: string;
  

  priority: 1 | 2 | 3;
  
  purpose: string;
}

export interface FrameworkVersionGrounding {
  
  framework: string;

  
  versionInference: VersionInference;

  
  apiPatterns: ApiPatternMatch[];

  

  groundingSources: GroundingSource[];

  

  versionClarificationQuestions: string[];
}

export interface VersionGroundingOutput {
  

  frameworks: FrameworkVersionGrounding[];

  

  detectedApiPatterns: ApiPatternMatch[];

  

  requiresVersionClarification: boolean;

  

  versionClarificationQuestions: string[];

  

  groundingSources: GroundingSource[];

  

  groundingSummary: string;
}

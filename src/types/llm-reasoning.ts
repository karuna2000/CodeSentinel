import { z } from 'zod';
import type { CodeUnderstandingOutput } from './code-understanding';
import type { VersionGroundingOutput } from './version-grounding';

export const FindingCategorySchema = z.enum([
  'architecture',
  'security',
  'performance',
  'scalability',
  'maintainability',
  'general',
]);

export const FindingSeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export const FindingSchema = z.object({
  category: FindingCategorySchema,
  severity: FindingSeveritySchema,
  title: z.string().describe('A concise, actionable title for the finding.'),
  explanation: z.string().describe('Detailed explanation of what the finding is.'),
  whyImportant: z.string().describe('Why this finding matters (the impact or risk).'),
  evidence: z.array(z.string()).describe('Specific lines of code, architectural signals, or patterns that led to this finding.'),
  recommendation: z.string().describe('A concrete recommendation on how to address the finding.'),
  confidence: z.number().min(0).max(1).describe('Confidence score (0.0 to 1.0) for this finding.'),
});

export type FindingCategory = z.infer<typeof FindingCategorySchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type Finding = z.infer<typeof FindingSchema>;

export const ReasoningOutputSchema = z.object({
  findings: z.array(FindingSchema).describe('The structured code-review findings.'),
  clarificationQuestions: z.array(
    z.object({
      question: z.string(),
      reason: z.string(),
    })
  ).max(3).describe('Questions to ask the user if the provided context is insufficient or highly ambiguous. Return an empty array if context is sufficient.'),
});

export type ReasoningOutput = z.infer<typeof ReasoningOutputSchema>;

export interface ReasoningContext {
  
  understandingSummary: string;
  
  
  framework: string | null;
  
  
  runtime: string | null;
  
  
  artifactType: string | null;
  
  
  dependencies: string[];
  
  
  architecturalSignals: string[];

  
  versionInferences: string[];

  
  apiPatterns: string[];

  
  groundingSources: string[];

  
  codeContent: string;
}

// ─── Follow-Up Chat Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatFindingContext {
  id: string;
  title: string;
  category: string;
  severity: string;
  explanation: string;
  recommendation: string;
  evidence: string[];
  codeSnippet?: string;
}

export interface ChatRequestBody {
  mode: 'chat';
  messages: ChatMessage[];
  findingContext?: ChatFindingContext;
}

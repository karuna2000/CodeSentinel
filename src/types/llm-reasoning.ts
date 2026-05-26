import { z } from 'zod';
import type { CodeUnderstandingOutput } from './code-understanding';
import type { VersionGroundingOutput } from './version-grounding';

// ---------------------------------------------------------------------------
// Finding Schemas (Structured Output)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reasoning Output Schema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Context Interfaces
// ---------------------------------------------------------------------------

/**
 * The structured context provided to the LLM for reasoning.
 * This is built from the deterministic understanding and version grounding systems.
 */
export interface ReasoningContext {
  /** Summary of the code understanding */
  understandingSummary: string;
  
  /** The framework detected, if any */
  framework: string | null;
  
  /** The runtime detected, if any */
  runtime: string | null;
  
  /** The artifact type detected, if any */
  artifactType: string | null;
  
  /** Key dependencies identified */
  dependencies: string[];
  
  /** Key architectural signals identified */
  architecturalSignals: string[];

  /** The versions inferred for the frameworks (e.g., 'React 18.x') */
  versionInferences: string[];

  /** The modern/deprecated API patterns detected in the code */
  apiPatterns: string[];

  /** The primary grounding source URLs that the LLM could be expected to know about or use as a reference */
  groundingSources: string[];

  /** The raw code content to analyze */
  codeContent: string;
}

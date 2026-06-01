

import type { VersionGroundingOutput, FrameworkVersionGrounding } from '@/types/version-grounding';
import { inferVersion, matchApiPatterns } from './version-signal-extractor';
import { buildGroundingSources, mergeGroundingSources } from './grounding-context-builder';
import { generateVersionClarificationQuestions, VERSION_CLARIFICATION_THRESHOLD } from './version-clarification-generator';

export function runVersionGrounding(
  detectedFrameworks: string[],
  content: string,
): VersionGroundingOutput {
  if (detectedFrameworks.length === 0) {
    return emptyOutput();
  }

  
  const frameworkVersionings: FrameworkVersionGrounding[] = detectedFrameworks
    .map((framework) => {
      const versionInference = safeRun(
        () => inferVersion(framework, content),
        {
          minVersion: null,
          maxVersion: null,
          label: `${framework} (version unknown)`,
          confidence: 0.20,
          signals: [],
        },
      );

      
      const apiPatterns = safeRun(
        () => matchApiPatterns(framework, content),
        [],
      );

      
      const groundingSources = safeRun(
        () => buildGroundingSources(framework, versionInference.label),
        [],
      );

      
      const versionClarificationQuestions = safeRun(
        () =>
          generateVersionClarificationQuestions([
            {
              framework,
              confidence: versionInference.confidence,
              versionLabel: versionInference.label,
            },
          ]),
        [],
      );

      return {
        framework,
        versionInference,
        apiPatterns,
        groundingSources,
        versionClarificationQuestions,
      };
    });

  
  const allApiPatterns = dedupApiPatterns(
    frameworkVersionings.flatMap((f) => f.apiPatterns),
  );

  
  const mergedSources = safeRun(
    () => mergeGroundingSources(frameworkVersionings.map((f) => f.groundingSources)),
    [],
  );

  
  const allVersionQuestions = dedupStrings(
    frameworkVersionings.flatMap((f) => f.versionClarificationQuestions),
  ).slice(0, 2); 

  const requiresVersionClarification =
    allVersionQuestions.length > 0 ||
    frameworkVersionings.some(
      (f) => f.versionInference.confidence < VERSION_CLARIFICATION_THRESHOLD,
    );

  
  const groundingSummary = buildGroundingSummary(frameworkVersionings);

  return {
    frameworks: frameworkVersionings,
    detectedApiPatterns: allApiPatterns,
    requiresVersionClarification,
    versionClarificationQuestions: allVersionQuestions,
    groundingSources: mergedSources,
    groundingSummary,
  };
}

function buildGroundingSummary(frameworkVersionings: FrameworkVersionGrounding[]): string {
  if (frameworkVersionings.length === 0) return 'No frameworks detected — no grounding required';

  const versionLabels = frameworkVersionings
    .filter((f) => f.versionInference.confidence >= 0.40)
    .map((f) => f.versionInference.label)
    .join(', ');

  const sourceCount = new Set(
    frameworkVersionings.flatMap((f) => f.groundingSources.map((s) => s.url)),
  ).size;

  const suffix = sourceCount > 0
    ? `— ${sourceCount} grounding source${sourceCount !== 1 ? 's' : ''} ready`
    : '— no grounding sources available';

  return versionLabels
    ? `${versionLabels} ${suffix}`
    : `${frameworkVersionings.map((f) => f.framework).join(', ')} (versions undetermined) ${suffix}`;
}

function emptyOutput(): VersionGroundingOutput {
  return {
    frameworks: [],
    detectedApiPatterns: [],
    requiresVersionClarification: false,
    versionClarificationQuestions: [],
    groundingSources: [],
    groundingSummary: 'No frameworks detected — no grounding required',
  };
}

function dedupApiPatterns(
  patterns: Array<{ api: string; framework: string; introducedInVersion: string; description: string; deprecatedInVersion: string | null }>,
) {
  const seen = new Set<string>();
  return patterns.filter((p) => {
    const key = `${p.framework}::${p.api}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Version Grounding — public barrel export.
 *
 * This is the single public API surface for the version-grounding feature.
 * All external consumers import from here.
 */

// Main orchestrator
export { runVersionGrounding } from './version-grounding-orchestrator';

// Sub-modules re-exported for testing and advanced usage
export { inferVersion, matchApiPatterns, findDeprecatedApis } from './version-signal-extractor';
export {
  buildGroundingSources,
  mergeGroundingSources,
  getPrimaryGroundingSources,
} from './grounding-context-builder';
export {
  generateVersionClarificationQuestions,
  VERSION_CLARIFICATION_THRESHOLD,
} from './version-clarification-generator';
export {
  FRAMEWORK_REGISTRY,
  getFrameworkEntry,
  getAllApiPatterns,
} from './framework-registry';



export { runVersionGrounding } from './version-grounding-orchestrator';

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

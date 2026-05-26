/**
 * Version Signal Extractor — infers framework/library versions from code patterns.
 *
 * Detection strategy:
 *  1. Explicit signals: inline version comments, config declarations
 *  2. API-pattern matching: specific hooks/methods tied to known versions
 *  3. Syntax/convention signals: routing conventions, directives
 *  4. Version bracket matching: from the framework registry
 *
 * Design:
 *  - Pure function, no side effects, no LLM calls
 *  - Uses the FRAMEWORK_REGISTRY for version brackets and API patterns
 *  - Returns a VersionInference with a label, range, confidence, and signals
 *  - Never pretends certainty — uses confidence < 0.65 threshold for clarification
 */

import type { VersionInference, ApiPatternMatch } from '@/types/version-grounding';
import { getFrameworkEntry, getAllApiPatterns } from './framework-registry';

// ---------------------------------------------------------------------------
// Explicit signal patterns (e.g. comments, pragma-style declarations)
// ---------------------------------------------------------------------------

const EXPLICIT_VERSION_PATTERNS: Array<{
  regex: RegExp;
  framework: string;
  extract: (match: RegExpMatchArray) => string | null;
}> = [
  // // @version 18.2.0  or  /* React ^18 */
  {
    regex: /[@]version\s+([\d.^~>=<]+)/i,
    framework: 'explicit-comment',
    extract: (m) => m[1] ?? null,
  },
  // engine field: "node": ">=18"
  {
    regex: /"node"\s*:\s*"([^"]+)"/,
    framework: 'Node.js',
    extract: (m) => m[1] ?? null,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Infers the version of a specific detected framework from code content.
 *
 * @param frameworkName  The detected framework (must match registry entry name)
 * @param content        Full code content to scan
 * @returns              VersionInference with label, range, confidence, signals
 */
export function inferVersion(
  frameworkName: string,
  content: string,
): VersionInference {
  const entry = getFrameworkEntry(frameworkName);

  if (!entry) {
    // Framework not in registry — return minimal inference
    return {
      minVersion: null,
      maxVersion: null,
      label: `${frameworkName} (version unknown)`,
      confidence: 0.20,
      signals: [],
    };
  }

  const matchedSignals: string[] = [];
  let bestBracket = null;
  let bracketConfidence = 0;

  // Walk version brackets newest-first, pick the first that matches
  for (const bracket of entry.versionBrackets) {
    const matched = bracket.indicators.filter((rx) => rx.test(content));
    if (matched.length > 0) {
      const score = Math.min(
        0.95,
        0.55 + bracket.confidenceBoost + (matched.length - 1) * 0.05,
      );
      if (score > bracketConfidence) {
        bestBracket = bracket;
        bracketConfidence = score;
        matchedSignals.push(
          ...matched.map((rx) => `${rx.source.slice(0, 60)} → ${bracket.label}`),
        );
      }
    }
  }

  if (bestBracket) {
    return {
      minVersion: bestBracket.minVersion,
      maxVersion: bestBracket.maxVersion,
      label: bestBracket.label,
      confidence: bracketConfidence,
      signals: matchedSignals,
    };
  }

  // No version bracket matched — return generic "detected but unversioned"
  return {
    minVersion: null,
    maxVersion: null,
    label: `${frameworkName} (version undetermined from code)`,
    confidence: 0.30,
    signals: [],
  };
}

// ---------------------------------------------------------------------------
// API pattern matching
// ---------------------------------------------------------------------------

/**
 * Scans code content for API patterns from the framework registry.
 *
 * @param frameworkName  Limit scan to patterns for this framework (or all if null)
 * @param content        Full code content
 * @returns              Array of matched ApiPatternMatch entries
 */
export function matchApiPatterns(
  frameworkName: string | null,
  content: string,
): ApiPatternMatch[] {
  const entry = frameworkName ? getFrameworkEntry(frameworkName) : null;
  const patterns: ApiPatternMatch[] = entry
    ? entry.apiPatterns
    : getAllApiPatterns();

  return patterns.filter((p) => {
    // For directive-style apis like '"use client"' or '"use server"',
    // generate a flexible regex that matches both single and double quotes.
    const trimmed = p.api
      .replace(/^"|"$/g, '') // strip leading/trailing double-quotes
      .replace(/^'|'$/g, ''); // strip leading/trailing single-quotes

    if (trimmed !== p.api) {
      // It was a quoted directive — match with any quote style
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`["']${escaped}["']`).test(content);
    }

    // Normal API name — escape special chars and allow optional space before parens
    const escaped = p.api
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\(\\\)/g, '\\s*\\(');
    return new RegExp(escaped).test(content);
  });
}

// ---------------------------------------------------------------------------
// Deprecation scanner
// ---------------------------------------------------------------------------

/**
 * Returns all API patterns present in the code that are deprecated
 * (i.e., have a deprecatedInVersion set).
 *
 * Downstream agents use this to flag outdated usage patterns.
 */
export function findDeprecatedApis(content: string): ApiPatternMatch[] {
  return matchApiPatterns(null, content).filter(
    (p) => p.deprecatedInVersion !== null,
  );
}

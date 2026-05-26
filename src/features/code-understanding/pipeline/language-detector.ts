/**
 * Language Detector — multi-signal programming language identification.
 *
 * Detection strategy (in order of priority):
 *  1. File extension mapping (highest certainty when available)
 *  2. Shebang line (`#!/...`) parsing
 *  3. Keyword/syntax heuristics over first 1 KB of content
 *  4. Fallback to "Unknown"
 *
 * Returns a LanguageDetection with confidence score and the signal source.
 * Confidence reflects how certain the detection is, not just a match.
 *
 * Design:
 *  - Pure function, no side effects
 *  - No LLM calls — fully deterministic
 *  - Works on first 1 KB sample for performance
 */

import type { LanguageDetection } from '@/types/code-understanding';

// ---------------------------------------------------------------------------
// Extension → Language map
// ---------------------------------------------------------------------------

const EXTENSION_LANGUAGE_MAP: Record<string, { name: string; confidence: number }> = {
  '.ts': { name: 'TypeScript', confidence: 0.98 },
  '.tsx': { name: 'TypeScript', confidence: 0.98 },
  '.js': { name: 'JavaScript', confidence: 0.97 },
  '.jsx': { name: 'JavaScript', confidence: 0.97 },
  '.mjs': { name: 'JavaScript', confidence: 0.97 },
  '.cjs': { name: 'JavaScript', confidence: 0.97 },
  '.py': { name: 'Python', confidence: 0.99 },
  '.pyw': { name: 'Python', confidence: 0.99 },
  '.go': { name: 'Go', confidence: 0.99 },
  '.rs': { name: 'Rust', confidence: 0.99 },
  '.java': { name: 'Java', confidence: 0.99 },
  '.kt': { name: 'Kotlin', confidence: 0.99 },
  '.kts': { name: 'Kotlin', confidence: 0.99 },
  '.cs': { name: 'C#', confidence: 0.99 },
  '.c': { name: 'C', confidence: 0.98 },
  '.cpp': { name: 'C++', confidence: 0.98 },
  '.cc': { name: 'C++', confidence: 0.98 },
  '.cxx': { name: 'C++', confidence: 0.98 },
  '.h': { name: 'C/C++', confidence: 0.85 },
  '.hpp': { name: 'C++', confidence: 0.97 },
  '.rb': { name: 'Ruby', confidence: 0.99 },
  '.php': { name: 'PHP', confidence: 0.99 },
  '.swift': { name: 'Swift', confidence: 0.99 },
  '.sql': { name: 'SQL', confidence: 0.99 },
  '.yaml': { name: 'YAML', confidence: 0.99 },
  '.yml': { name: 'YAML', confidence: 0.99 },
  '.json': { name: 'JSON', confidence: 0.99 },
  '.xml': { name: 'XML', confidence: 0.99 },
  '.html': { name: 'HTML', confidence: 0.99 },
  '.htm': { name: 'HTML', confidence: 0.99 },
  '.css': { name: 'CSS', confidence: 0.99 },
  '.scss': { name: 'SCSS', confidence: 0.99 },
  '.sass': { name: 'Sass', confidence: 0.99 },
  '.less': { name: 'Less', confidence: 0.99 },
  '.sh': { name: 'Shell', confidence: 0.99 },
  '.bash': { name: 'Shell', confidence: 0.99 },
  '.zsh': { name: 'Shell', confidence: 0.99 },
  '.fish': { name: 'Shell', confidence: 0.99 },
  '.md': { name: 'Markdown', confidence: 0.99 },
  '.mdx': { name: 'MDX', confidence: 0.98 },
  '.vue': { name: 'Vue', confidence: 0.99 },
  '.svelte': { name: 'Svelte', confidence: 0.99 },
  '.graphql': { name: 'GraphQL', confidence: 0.99 },
  '.gql': { name: 'GraphQL', confidence: 0.99 },
  '.proto': { name: 'Protocol Buffers', confidence: 0.99 },
  '.toml': { name: 'TOML', confidence: 0.99 },
  '.env': { name: 'Environment Config', confidence: 0.90 },
  '.dockerfile': { name: 'Dockerfile', confidence: 0.99 },
  '.tf': { name: 'Terraform (HCL)', confidence: 0.99 },
  '.hcl': { name: 'HCL', confidence: 0.99 },
  '.r': { name: 'R', confidence: 0.97 },
  '.scala': { name: 'Scala', confidence: 0.99 },
  '.clj': { name: 'Clojure', confidence: 0.99 },
  '.ex': { name: 'Elixir', confidence: 0.99 },
  '.exs': { name: 'Elixir', confidence: 0.99 },
  '.lua': { name: 'Lua', confidence: 0.99 },
  '.zig': { name: 'Zig', confidence: 0.99 },
  '.txt': { name: 'Plain Text', confidence: 0.60 },
};

// ---------------------------------------------------------------------------
// Shebang patterns
// ---------------------------------------------------------------------------

const SHEBANG_PATTERNS: Array<{ pattern: RegExp; language: string }> = [
  { pattern: /^#!.*\bpython3?\b/, language: 'Python' },
  { pattern: /^#!.*\bnode\b/, language: 'JavaScript' },
  { pattern: /^#!.*\b(bash|sh|zsh|fish|dash)\b/, language: 'Shell' },
  { pattern: /^#!.*\bruby\b/, language: 'Ruby' },
  { pattern: /^#!.*\bperl\b/, language: 'Perl' },
  { pattern: /^#!.*\bphp\b/, language: 'PHP' },
];

// ---------------------------------------------------------------------------
// Content heuristic rules
// ---------------------------------------------------------------------------

interface LanguageHeuristic {
  language: string;
  confidence: number;
  /** All patterns must match for confidence ≥ 0.7; any one = 0.5 */
  strongPatterns: RegExp[];
  /** Any single match gives base confidence */
  weakPatterns: RegExp[];
}

const HEURISTIC_RULES: LanguageHeuristic[] = [
  // TypeScript (check before JS — more specific)
  {
    language: 'TypeScript',
    confidence: 0.82,
    strongPatterns: [
      /\b(interface|type\s+\w+\s*=|:\s*(string|number|boolean|void|never|unknown|any)\b)/,
      /\b(as\s+const|readonly\s+|Promise<|Record<|Partial<|Required<)/,
    ],
    weakPatterns: [
      /\b(interface\s+\w+|type\s+\w+\s*=|:\s*string|: number|: boolean|as const|readonly )\b/,
    ],
  },
  // React/JSX — check before pure TS/JS
  {
    language: 'TypeScript',
    confidence: 0.85,
    strongPatterns: [
      /import React|from ['"]react['"]/,
      /return\s*\(\s*</,
    ],
    weakPatterns: [/<[A-Z][a-zA-Z]*[\s/>]|JSX\.Element|React\.FC/],
  },
  // JavaScript (after TS)
  {
    language: 'JavaScript',
    confidence: 0.70,
    strongPatterns: [
      /\b(const|let|var)\s+\w+\s*=/,
      /\b(require\(|module\.exports|exports\.\w+)/,
    ],
    weakPatterns: [/\b(require\(|module\.exports|=>|async\s+function)\b/],
  },
  // Python
  {
    language: 'Python',
    confidence: 0.88,
    strongPatterns: [
      /\b(def\s+\w+\s*\(|class\s+\w+(\([\w,\s]*\))?:)/,
      /\b(import\s+\w+|from\s+\w+\s+import)/,
    ],
    weakPatterns: [/\b(def |print\(|if __name__|lambda |elif )\b/],
  },
  // Go
  {
    language: 'Go',
    confidence: 0.90,
    strongPatterns: [
      /^package\s+[a-z]+/m,
      /\bfunc\s+[A-Za-z]/,
    ],
    weakPatterns: [/\b(func |fmt\.|go func|chan |defer |goroutine)\b/],
  },
  // Rust
  {
    language: 'Rust',
    confidence: 0.90,
    strongPatterns: [
      /\b(fn\s+\w+|let\s+mut\s+|impl\s+\w+)/,
      /\b(use\s+std::|pub\s+(struct|enum|fn)|#\[derive)/,
    ],
    weakPatterns: [/\b(fn |let mut|impl |use std::|println!|unwrap\(\))\b/],
  },
  // Java
  {
    language: 'Java',
    confidence: 0.88,
    strongPatterns: [
      /\b(public\s+class|private\s+|protected\s+)\w/,
      /\b(import\s+java\.|System\.out\.println|@Override)\b/,
    ],
    weakPatterns: [/\b(public class|private void|@Override|new \w+\()\b/],
  },
  // C#
  {
    language: 'C#',
    confidence: 0.87,
    strongPatterns: [
      /\b(namespace\s+\w+|using\s+System)/,
      /\b(public\s+(class|interface|enum|struct)|private\s+(void|int|string))\b/,
    ],
    weakPatterns: [/\b(namespace |using System|Console\.Write|var |\.NET)\b/],
  },
  // SQL
  {
    language: 'SQL',
    confidence: 0.88,
    strongPatterns: [
      /^\s*(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)/im,
    ],
    weakPatterns: [/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP TABLE)\b/i],
  },
  // Shell
  {
    language: 'Shell',
    confidence: 0.80,
    strongPatterns: [
      /^(export\s+\w+=|source\s+|chmod\s+|sudo\s+|apt\s+|brew\s+)/m,
      /\$\{?\w+\}?|\$\(.*\)/,
    ],
    weakPatterns: [/\b(echo |grep |awk |sed |chmod |curl |wget )\b/],
  },
  // YAML
  {
    language: 'YAML',
    confidence: 0.72,
    strongPatterns: [
      /^[a-zA-Z_][a-zA-Z0-9_-]*:\s+\S/m,
      /^\s+-\s+\w+/m,
    ],
    weakPatterns: [/^---\s*$/m],
  },
  // JSON
  {
    language: 'JSON',
    confidence: 0.85,
    strongPatterns: [/^\s*[{[]/],
    weakPatterns: [/"[^"]+"\s*:/],
  },
  // HTML
  {
    language: 'HTML',
    confidence: 0.92,
    strongPatterns: [/<!DOCTYPE html|<html[\s>]/i],
    weakPatterns: [/<(head|body|div|span|p|a)\s*[\s>]/i],
  },
  // CSS
  {
    language: 'CSS',
    confidence: 0.82,
    strongPatterns: [
      /[.#][\w-]+\s*\{[^}]+\}/,
      /@(media|keyframes|import|font-face)/,
    ],
    weakPatterns: [/\{[^}]*:[^}]*;[^}]*\}/],
  },
  // Markdown
  {
    language: 'Markdown',
    confidence: 0.70,
    strongPatterns: [/^#{1,6}\s+\S/m, /^\[.+\]\(.+\)/m],
    weakPatterns: [/^[-*]\s+\w/m],
  },
  // GraphQL
  {
    language: 'GraphQL',
    confidence: 0.90,
    strongPatterns: [/\b(type\s+\w+\s*\{|query\s+\w+|mutation\s+\w+|fragment\s+\w+\s+on)\b/],
    weakPatterns: [/\b(Query|Mutation|Subscription|schema\s*\{)\b/],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects the programming language of a code artifact.
 *
 * @param content  Raw text content of the file
 * @param filename Optional filename (used for extension detection)
 */
export function detectLanguage(content: string, filename?: string): LanguageDetection {
  // 1. Extension detection (highest priority when available)
  if (filename) {
    const ext = extractExtension(filename);
    const extMatch = EXTENSION_LANGUAGE_MAP[ext];
    if (extMatch) {
      return {
        name: extMatch.name,
        confidence: extMatch.confidence,
        detectedVia: 'extension',
      };
    }

    // Special case: Dockerfile (no extension)
    if (filename.toLowerCase() === 'dockerfile' || filename.toLowerCase().endsWith('/dockerfile')) {
      return { name: 'Dockerfile', confidence: 0.99, detectedVia: 'extension' };
    }
  }

  const sample = content.slice(0, 1200);

  // 2. Shebang detection
  if (sample.startsWith('#!')) {
    for (const { pattern, language } of SHEBANG_PATTERNS) {
      if (pattern.test(sample)) {
        return { name: language, confidence: 0.92, detectedVia: 'shebang' };
      }
    }
  }

  // 3. Content heuristics
  for (const rule of HEURISTIC_RULES) {
    const strongMatch = rule.strongPatterns.every((p) => p.test(sample));
    if (strongMatch) {
      return {
        name: rule.language,
        confidence: rule.confidence,
        detectedVia: 'syntax-heuristic',
      };
    }
    const weakMatch = rule.weakPatterns.some((p) => p.test(sample));
    if (weakMatch) {
      return {
        name: rule.language,
        confidence: rule.confidence * 0.65,
        detectedVia: 'keyword',
      };
    }
  }

  // 4. Fallback
  return { name: 'Unknown', confidence: 0.10, detectedVia: 'fallback' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) return '';
  return filename.substring(dotIndex).toLowerCase();
}

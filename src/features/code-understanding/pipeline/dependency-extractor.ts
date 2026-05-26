/**
 * Dependency Extractor — extracts import/require/use declarations.
 *
 * Supports multi-language extraction:
 *  - TypeScript / JavaScript: `import … from '…'`, `require('…')`, `import('…')`
 *  - Python: `import …`, `from … import …`
 *  - Go: `import "…"` and block imports
 *  - Rust: `use …::` (top-level crate references)
 *  - Java / C#: `import …` / `using …`
 *  - CSS/SCSS: `@import '…'`
 *
 * Design:
 *  - Pure function, no side effects
 *  - Returns deduped, order-preserved list (first appearance first)
 *  - Relative imports are included (they reveal internal structure)
 *  - External packages separated from relative imports is not the concern here
 *    — consumers can filter by prefix if needed
 */

// ---------------------------------------------------------------------------
// Extraction patterns per language family
// ---------------------------------------------------------------------------

interface ExtractionRule {
  /** Regex that captures the import path in group 1 */
  regex: RegExp;
  /** Optional: only run this rule when language matches */
  forLanguages?: string[];
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // TS/JS: import X from 'module'  |  import { X } from 'module'  |  import type X from 'module'
  {
    regex: /\bimport\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
  },

  // TS/JS: require('module')  |  require("module")
  {
    regex: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },

  // TS/JS: dynamic import('module')
  {
    regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },

  // Python: import module  |  import module as alias
  {
    regex: /^import\s+([\w.]+)(?:\s+as\s+\w+)?/gm,
    forLanguages: ['Python'],
  },

  // Python: from module import X
  {
    regex: /^from\s+([\w.]+)\s+import/gm,
    forLanguages: ['Python'],
  },

  // Go: import "module"  |  import ( "module" )
  {
    regex: /import\s+"([^"]+)"/g,
    forLanguages: ['Go'],
  },

  // Go block imports: individual quoted paths inside import (...)
  {
    regex: /^\s+"([^"]+)"\s*$/gm,
    forLanguages: ['Go'],
  },

  // Rust: use crate::path  |  use std::collections::HashMap
  {
    regex: /^use\s+([\w:]+)/gm,
    forLanguages: ['Rust'],
  },

  // Java: import com.example.ClassName
  {
    regex: /^import\s+([\w.]+);/gm,
    forLanguages: ['Java'],
  },

  // C#: using System.Collections
  {
    regex: /^using\s+([\w.]+);/gm,
    forLanguages: ['C#'],
  },

  // CSS / SCSS: @import 'module' or @import "module"
  {
    regex: /@import\s+['"]([^'"]+)['"]/g,
    forLanguages: ['CSS', 'SCSS', 'Sass', 'Less'],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts all import/dependency references from the code content.
 *
 * @param content  Full raw file content
 * @param language Detected language (used to apply language-specific rules)
 * @returns        Deduplicated array of import paths/module names
 */
export function extractDependencies(content: string, language: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rule of EXTRACTION_RULES) {
    // Skip language-specific rules that don't apply
    if (rule.forLanguages && !rule.forLanguages.some((l) => language.toLowerCase().includes(l.toLowerCase()))) {
      continue;
    }

    // Reset lastIndex for global regexes before each full scan
    rule.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(content)) !== null) {
      const dep = match[1]?.trim();
      if (dep && !seen.has(dep)) {
        seen.add(dep);
        result.push(dep);
      }
    }
  }

  return result;
}

/**
 * Filters a dependency list to only external packages (non-relative, non-builtin-alias).
 * Relative imports start with './' or '../'; internal aliases start with '@/'.
 *
 * This is a utility helper — consumers can use it to separate
 * "npm packages" from "internal modules".
 */
export function getExternalDependencies(deps: string[]): string[] {
  return deps.filter(
    (d) => !d.startsWith('.') && !d.startsWith('@/') && !d.startsWith('~/'),
  );
}

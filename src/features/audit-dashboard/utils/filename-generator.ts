/**
 * Virtual filename generator for pasted code artifacts.
 *
 * When users paste code without a filename, we generate a meaningful
 * virtual filename that reflects the likely language of the content.
 * This makes pasted artifacts feel like first-class named entities.
 *
 * Approach: lightweight keyword/pattern heuristics — no heavy parsing,
 * no AI inference, no blocking operations.
 */

// ---------------------------------------------------------------------------
// Language pattern rules (ordered by specificity)
// ---------------------------------------------------------------------------

interface LanguageRule {
  /** Pattern to test against the first ~500 chars of content */
  pattern: RegExp;
  /** Virtual filename to generate */
  filename: string;
  /** Display language label */
  language: string;
  /** Extension for language detection pipeline */
  extension: string;
}

const LANGUAGE_RULES: LanguageRule[] = [
  // Shell script — shebang is highly distinctive, check first
  {
    pattern: /^#!\/bin\/(ba)?sh|^(export|source|chmod|sudo|apt|brew)\s/m,
    filename: 'pasted-script.sh',
    language: 'Shell',
    extension: '.sh',
  },
  // SQL — require a leading SQL verb (not just FROM which appears in Python imports)
  {
    pattern: /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP TABLE|ALTER TABLE)\b/im,
    filename: 'pasted-query.sql',
    language: 'SQL',
    extension: '.sql',
  },
  // HTML
  {
    pattern: /<!DOCTYPE html|<html|<head>|<body>/i,
    filename: 'pasted-markup.html',
    language: 'HTML',
    extension: '.html',
  },
  // JSON — starts with { or [
  {
    pattern: /^\s*[{\[]/,
    filename: 'pasted-data.json',
    language: 'JSON',
    extension: '.json',
  },
  // TSX/JSX — must come before TypeScript (more specific)
  {
    pattern: /import React|<[A-Z][a-zA-Z]*[\s/>]|return \([\s\n]*</,
    filename: 'pasted-component.tsx',
    language: 'TypeScript / React',
    extension: '.tsx',
  },
  // Go — check before Python since Go's import uses double-quotes
  {
    pattern: /^package [a-z]+|\bfunc [a-zA-Z]|import "[a-z]|fmt\.|go routines?|chan |defer /m,
    filename: 'pasted-input.go',
    language: 'Go',
    extension: '.go',
  },
  // Rust
  {
    pattern: /\b(fn |let mut|impl |use std::|pub struct|#\[derive|println!|unwrap\(\))/,
    filename: 'pasted-input.rs',
    language: 'Rust',
    extension: '.rs',
  },
  // Python — def/class + colon pattern, print(), import
  {
    pattern: /\b(def |class .+:|from .+ import|print\(|if __name__|lambda )|^import [a-z_]+$/m,
    filename: 'pasted-input.py',
    language: 'Python',
    extension: '.py',
  },
  // Java / Kotlin
  {
    pattern: /\b(public class|private void|@Override|System\.out\.println|import java\.|fun .*:.*\{)/,
    filename: 'pasted-input.java',
    language: 'Java',
    extension: '.java',
  },
  // TypeScript — interface/type/generic syntax
  {
    pattern: /\b(interface |type |: string|: number|: boolean|as const|readonly |Promise<)/,
    filename: 'pasted-input.ts',
    language: 'TypeScript',
    extension: '.ts',
  },
  // CSS / SCSS
  {
    pattern: /\{[\s\n]*[a-z-]+\s*:\s*[^}]+\}|@media|@keyframes|\.{1}[\w-]+\s*\{/,
    filename: 'pasted-styles.css',
    language: 'CSS',
    extension: '.css',
  },
  // YAML — key: value pattern (checked late, after JSON/HTML already ruled out)
  {
    pattern: /^[a-zA-Z_][a-zA-Z0-9_-]*:\s+\S/m,
    filename: 'pasted-config.yaml',
    language: 'YAML',
    extension: '.yaml',
  },
  // Markdown
  {
    pattern: /^#+\s.+|^\*{1,2}.+\*{1,2}|^\[.+\]\(.+\)/m,
    filename: 'pasted-notes.md',
    language: 'Markdown',
    extension: '.md',
  },
  // JavaScript — const/let/var, arrow functions, require/module.exports
  {
    pattern: /\b(const |let |var |require\(|module\.exports|=>\s*\{|async function|\.then\(|\.catch\()/,
    filename: 'pasted-input.js',
    language: 'JavaScript',
    extension: '.js',
  },
];

export interface VirtualFilename {
  filename: string;
  language: string;
  extension: string;
}

/**
 * Generates a virtual filename + language label for pasted code content.
 * Tests the first 800 characters for performance — sufficient for language detection.
 * Falls back to a generic "pasted-snippet.txt" for unrecognised content.
 */
export function generateVirtualFilename(content: string): VirtualFilename {
  const sample = content.slice(0, 800);

  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(sample)) {
      return {
        filename: rule.filename,
        language: rule.language,
        extension: rule.extension,
      };
    }
  }

  return {
    filename: 'pasted-snippet.txt',
    language: 'Plain Text',
    extension: '.txt',
  };
}

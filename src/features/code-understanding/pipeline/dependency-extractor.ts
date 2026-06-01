

interface ExtractionRule {
  
  regex: RegExp;
  
  forLanguages?: string[];
}

const EXTRACTION_RULES: ExtractionRule[] = [
  
  {
    regex: /\bimport\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
  },

  
  {
    regex: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },

  
  {
    regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  },

  
  {
    regex: /^import\s+([\w.]+)(?:\s+as\s+\w+)?/gm,
    forLanguages: ['Python'],
  },

  
  {
    regex: /^from\s+([\w.]+)\s+import/gm,
    forLanguages: ['Python'],
  },

  
  {
    regex: /import\s+"([^"]+)"/g,
    forLanguages: ['Go'],
  },

  // Go block imports: individual quoted paths inside import (...)
  {
    regex: /^\s+"([^"]+)"\s*$/gm,
    forLanguages: ['Go'],
  },

  
  {
    regex: /^use\s+([\w:]+)/gm,
    forLanguages: ['Rust'],
  },

  
  {
    regex: /^import\s+([\w.]+);/gm,
    forLanguages: ['Java'],
  },

  
  {
    regex: /^using\s+([\w.]+);/gm,
    forLanguages: ['C#'],
  },

  
  {
    regex: /@import\s+['"]([^'"]+)['"]/g,
    forLanguages: ['CSS', 'SCSS', 'Sass', 'Less'],
  },
];

export function extractDependencies(content: string, language: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rule of EXTRACTION_RULES) {
    
    if (rule.forLanguages && !rule.forLanguages.some((l) => language.toLowerCase().includes(l.toLowerCase()))) {
      continue;
    }

    
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

export function getExternalDependencies(deps: string[]): string[] {
  return deps.filter(
    (d) => !d.startsWith('.') && !d.startsWith('@/') && !d.startsWith('~/'),
  );
}

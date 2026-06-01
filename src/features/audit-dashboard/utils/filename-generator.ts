import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
// Honeypot languages to accurately detect and reject non-JS/TS code
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';

// Register only the languages we care about (plus XML for JSX/TSX support)
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
// Register honeypots so highlight.js doesn't shoehorn Python into JS
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('bash', bash);

export interface VirtualFilename {
  filename: string;
  language: string;
  extension: string;
  relevance: number;
  isSupportedCode: boolean;
  isUnsupportedCode: boolean;
}

/**
 * Generates a virtual filename + language label for pasted code content.
 * Uses highlight.js to accurately detect JS/TS without false positives.
 */
export function generateVirtualFilename(content: string): VirtualFilename {
  // We test a subset of the string for performance
  const sample = content.slice(0, 1500);

  // highlightAuto will ONLY score against the registered languages
  const result = hljs.highlightAuto(sample);

  // If the score is very low, it's likely plain text or a chat message
  if (result.relevance < 2 || !result.language) {
    return {
      filename: 'pasted-snippet.txt',
      language: 'Unknown / Plain Text',
      extension: '.txt',
      relevance: result.relevance,
      isSupportedCode: false,
      isUnsupportedCode: false,
    };
  }

  // It's definitely code. Is it supported?
  const lang = result.language;
  const isSupported = ['javascript', 'typescript', 'xml'].includes(lang);

  switch (lang) {
    case 'typescript':
      // highlight.js classifies TSX as typescript usually, but we'll default to .ts
      return {
        filename: 'pasted-input.ts',
        language: 'TypeScript',
        extension: '.ts',
        relevance: result.relevance,
        isSupportedCode: true,
        isUnsupportedCode: false,
      };
    case 'javascript':
      return {
        filename: 'pasted-input.js',
        language: 'JavaScript',
        extension: '.js',
        relevance: result.relevance,
        isSupportedCode: true,
        isUnsupportedCode: false,
      };
    case 'xml':
      // React components often get flagged as XML if they are mostly tags
      return {
        filename: 'pasted-component.tsx',
        language: 'TSX / JSX',
        extension: '.tsx',
        relevance: result.relevance,
        isSupportedCode: true,
        isUnsupportedCode: false,
      };
    default:
      // This catches the honeypots (python, java, go, rust, bash)
      const friendlyName = lang.charAt(0).toUpperCase() + lang.slice(1);
      return {
        filename: 'pasted-snippet.txt',
        language: friendlyName,
        extension: '.txt',
        relevance: result.relevance,
        isSupportedCode: false,
        isUnsupportedCode: true,
      };
  }
}

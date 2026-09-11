import path from 'path';
import type { Parser as ParserType, Language as LanguageType } from 'web-tree-sitter';

// web-tree-sitter v0.27 CJS exports named classes: Parser, Language, etc.
// DO NOT do: const Parser = require('web-tree-sitter') — that's not the Parser class.
// The module shape is: { Parser, Language, Query, Tree, ... }
const wts = require('web-tree-sitter') as {
  Parser: (new () => ParserType) & { init: (opts?: object) => Promise<void> };
  Language: { load: (path: string) => Promise<LanguageType> };
  Query: new (language: LanguageType, source: string) => { matches: (node: any) => any[] };
};

let parserInitialized = false;

// Language instances
let tsLanguage: LanguageType | null = null;
let jsLanguage: LanguageType | null = null;
let pythonLanguage: LanguageType | null = null;

const WASM_DIR = path.join(process.cwd(), 'public', 'tree-sitter');

// Path to the core wasm bundled with the npm package
const CORE_WASM = path.join(
  process.cwd(),
  'node_modules',
  'web-tree-sitter',
  'web-tree-sitter.wasm'
);

export async function initParser() {
  if (parserInitialized) return;

  await wts.Parser.init({
    locateFile(scriptName: string) {
      // Core runtime wasm — use the package's own file
      if (scriptName === 'web-tree-sitter.wasm') return CORE_WASM;
      // Language-specific wasms — use our public/ copies
      return path.join(WASM_DIR, scriptName);
    },
  });

  parserInitialized = true;
}

export async function getLanguage(lang: 'typescript' | 'javascript' | 'python'): Promise<LanguageType> {
  await initParser();

  if (lang === 'typescript') {
    if (!tsLanguage) {
      tsLanguage = await wts.Language.load(path.join(WASM_DIR, 'tree-sitter-typescript.wasm'));
    }
    return tsLanguage!;
  }
  if (lang === 'javascript') {
    if (!jsLanguage) {
      jsLanguage = await wts.Language.load(path.join(WASM_DIR, 'tree-sitter-javascript.wasm'));
    }
    return jsLanguage!;
  }
  if (lang === 'python') {
    if (!pythonLanguage) {
      pythonLanguage = await wts.Language.load(path.join(WASM_DIR, 'tree-sitter-python.wasm'));
    }
    return pythonLanguage!;
  }

  throw new Error(`Unsupported language: ${lang}`);
}

export async function parseCode(code: string, lang: 'typescript' | 'javascript' | 'python'): Promise<ReturnType<ParserType['parse']>> {
  const language = await getLanguage(lang);
  const parser = new wts.Parser();
  parser.setLanguage(language);
  return parser.parse(code);
}

import type TreeSitter from 'web-tree-sitter';
import crypto from 'crypto';

export interface ExtractedSymbol {
  type: 'CLASS' | 'FUNCTION' | 'INTERFACE' | 'TYPE' | 'VARIABLE';
  name: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  signature: string;
  codeSnippet: string;
  documentation: string;
  contentHash: string;
}

const MAX_SNIPPET_CHARS = 3000;
const MAX_SIGNATURE_CHARS = 240;
const MAX_DOC_CHARS = 800;

// Collapse the declaration to a single line, stopping at the opening brace.
// "export async function getSession(request: NextRequest)" — enough to ground
// the model without persisting the whole body as a signature.
function makeSignature(text: string): string {
  const braceIdx = text.indexOf('{');
  let sig = braceIdx === -1 ? text : text.slice(0, braceIdx);
  sig = sig.replace(/\s+/g, ' ').trim();
  if (sig.length > MAX_SIGNATURE_CHARS) {
    sig = sig.slice(0, MAX_SIGNATURE_CHARS) + '…';
  }
  return sig;
}

// Scan upward from the declaration row for contiguous comment lines.
// Handles JSDoc block comments and // line comments.
function extractDocumentation(content: string, startRow: number): string {
  const lines = content.split('\n');
  const docs: string[] = [];

  for (let i = startRow - 1; i >= 0; i--) {
    const trimmed = (lines[i] ?? '').trim();
    const isComment =
      trimmed.startsWith('/**') ||
      trimmed.startsWith('*/') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('#');

    if (!isComment) break;

    const cleaned = trimmed
      .replace(/^\/\*\*?/, '')
      .replace(/^\*\/?/, '')
      .replace(/^\/\/\s?/, '')
      .replace(/^#\s?/, '')
      .trim();
    docs.unshift(cleaned);
  }

  return docs.filter(Boolean).join(' ').trim().slice(0, MAX_DOC_CHARS);
}

const tsQueries = `
(class_declaration name: (type_identifier) @name) @class
(function_declaration name: (identifier) @name) @function
(interface_declaration name: (type_identifier) @name) @interface
(type_alias_declaration name: (type_identifier) @name) @type
(lexical_declaration (variable_declarator name: (identifier) @name value: (arrow_function))) @variable
`;

const jsQueries = `
(class_declaration name: (identifier) @name) @class
(function_declaration name: (identifier) @name) @function
(lexical_declaration (variable_declarator name: (identifier) @name value: (arrow_function))) @variable
`;

const pyQueries = `
(class_definition name: (identifier) @name) @class
(function_definition name: (identifier) @name) @function
`;

export function extractSymbols(
  tree: TreeSitter.Tree,
  language: TreeSitter.Language,
  langType: 'typescript' | 'javascript' | 'python',
  content: string
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];

  let queryString = '';
  if (langType === 'typescript') {
    queryString = tsQueries;
  } else if (langType === 'javascript') {
    queryString = jsQueries;
  } else if (langType === 'python') {
    queryString = pyQueries;
  }

  if (!queryString) return symbols;

  try {
    const wts = require('web-tree-sitter');
    const query = new wts.Query(language, queryString);
    const matches = query.matches(tree.rootNode);

    for (const match of matches) {
      // Find the main definition node and the name node in this match
      let defNode: TreeSitter.Node | null = null;
      let nameNode: TreeSitter.Node | null = null;
      let type: ExtractedSymbol['type'] | null = null;

      for (const capture of match.captures) {
        if (capture.name === 'name') {
          nameNode = capture.node;
        } else if (['class', 'function', 'interface', 'type', 'variable'].includes(capture.name)) {
          defNode = capture.node;
          type = capture.name.toUpperCase() as ExtractedSymbol['type'];
        }
      }

      if (defNode && nameNode && type) {
        // Prevent duplicates (query might match multiple ways depending on grammar complexity)
        const exists = symbols.some(s => s.name === nameNode!.text && s.startLine === defNode!.startPosition.row + 1);
        if (!exists) {
          const startLine = defNode.startPosition.row + 1; // 1-indexed for our DB
          const endLine = defNode.endPosition.row + 1;
          const codeSnippet = defNode.text.slice(0, MAX_SNIPPET_CHARS);
          const signature = makeSignature(defNode.text);
          const documentation = extractDocumentation(content, defNode.startPosition.row);
          const contentHash = crypto
            .createHash('sha256')
            .update(`${type}:${signature}:${codeSnippet}`)
            .digest('hex');

          symbols.push({
            type,
            name: nameNode.text,
            startLine,
            endLine,
            startByte: defNode.startIndex,
            endByte: defNode.endIndex,
            signature,
            codeSnippet,
            documentation,
            contentHash,
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to execute query for ${langType}:`, error);
  }

  return symbols;
}
import type TreeSitter from 'web-tree-sitter';
import * as wts from 'web-tree-sitter';

export interface ExtractedEdge {
  type: 'IMPORTS' | 'CALLS' | 'READS_STORE' | 'FETCHES_ROUTE';
  target: string;
  startLine: number;
  metadata?: Record<string, string>;
}

const tsQueries = `
(import_statement source: (string (string_fragment) @source)) @import
(call_expression function: (identifier) @source) @call
(call_expression function: (member_expression property: (property_identifier) @source)) @call
`;

const pyQueries = `
(import_statement name: (dotted_name) @source) @import
(import_from_statement module_name: (dotted_name) @source) @import
(call function: (identifier) @source) @call
(call function: (attribute attribute: (identifier) @source)) @call
`;

export function extractEdges(
  tree: TreeSitter.Tree,
  language: TreeSitter.Language,
  langType: 'typescript' | 'javascript' | 'python'
): ExtractedEdge[] {
  const edges: ExtractedEdge[] = [];
  
  let queryString = '';
  if (langType === 'typescript' || langType === 'javascript') {
    queryString = tsQueries;
  } else if (langType === 'python') {
    queryString = pyQueries;
  }

  if (!queryString) return edges;

  try {
    const query = new wts.Query(language, queryString);
    const matches = query.matches(tree.rootNode);

    for (const match of matches) {
      let targetName: string | null = null;
      let edgeType: ExtractedEdge['type'] | null = null;
      let startLine = 0;
      let callExpression: string | undefined;

      for (const capture of match.captures) {
        if (capture.name === 'source') {
          targetName = capture.node.text;
          startLine = capture.node.startPosition.row + 1;
        } else if (capture.name === 'import') {
          edgeType = 'IMPORTS';
        } else if (capture.name === 'call') {
          edgeType = 'CALLS';
        }
      }

      if (targetName && edgeType) {
        // Refine behavior for specific React/Next patterns (FETCHES_ROUTE, READS_STORE)
        if (edgeType === 'CALLS') {
          if (targetName === 'fetch') {
            edgeType = 'FETCHES_ROUTE';
          } else if (targetName.startsWith('use') && targetName.toLowerCase().includes('store')) {
            edgeType = 'READS_STORE';
          }

          // Capture the full call expression text for metadata
          for (const capture of match.captures) {
            if (capture.name === 'call') {
              callExpression = capture.node.parent?.text ?? targetName;
              break;
            }
          }
        }

        const metadata: Record<string, string> = {};
        if (edgeType === 'CALLS' && callExpression) {
          metadata.expression = callExpression.length > 200
            ? callExpression.slice(0, 200) + '...'
            : callExpression;
        }
        if (edgeType === 'IMPORTS') {
          metadata.importPath = targetName;
        }

        edges.push({
          type: edgeType,
          target: targetName,
          startLine,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }
    }
  } catch (error) {
    console.warn(`Failed to execute query for ${langType}:`, error);
  }

  return edges;
}

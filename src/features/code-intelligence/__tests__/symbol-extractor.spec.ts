import { describe, it, expect } from 'vitest';
import { parseCode, getLanguage } from '@/features/code-intelligence/parser';
import { extractSymbols } from '@/features/code-intelligence/symbol-extractor';

const TS_SAMPLE = `
/**
 * Parses an incoming request and returns the authenticated session.
 */
export async function getSession(request: NextRequest): Promise<Session | null> {
  const token = request.headers.get('authorization');
  if (!token) return null;
  return { user: token };
}

// Clamps a value to the inclusive range.
export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
`;

const PY_SAMPLE = `
class UserService:
    """Resolves users from the database."""

    def find(self, user_id: str):
        return {"id": user_id}
`;

describe('extractSymbols — TypeScript evidence', () => {
  it('captures full evidence: signature, bytes, doc, snippet, hash', async () => {
    const tree = (await parseCode(TS_SAMPLE, 'typescript'))!;
    const language = await getLanguage('typescript');
    const symbols = extractSymbols(tree, language, 'typescript', TS_SAMPLE);

    expect(symbols).toHaveLength(2);

    const session = symbols.find((s) => s.name === 'getSession')!;
    expect(session.type).toBe('FUNCTION');
    expect(session.signature).toContain('async function getSession(request');
    expect(session.signature).not.toContain('{');
    expect(session.codeSnippet).toContain('return { user: token }');
    expect(session.documentation).toContain('Parses an incoming request');
    expect(session.startLine).toBeGreaterThan(0);
    expect(session.endLine).toBeGreaterThanOrEqual(session.startLine);
    expect(session.startByte).toBeGreaterThan(0);
    expect(session.endByte).toBeGreaterThan(session.startByte);
    expect(session.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const clamp = symbols.find((s) => s.name === 'clamp')!;
    expect(clamp.documentation).toContain('Clamps a value');
    expect(clamp.codeSnippet).toContain('Math.min');
  });

  it('produces stable hashes for identical symbols', async () => {
    const tree = (await parseCode(TS_SAMPLE, 'typescript'))!;
    const language = await getLanguage('typescript');
    const a = extractSymbols(tree, language, 'typescript', TS_SAMPLE);
    const b = extractSymbols(tree, language, 'typescript', TS_SAMPLE);
    expect(a.find((s) => s.name === 'clamp')!.contentHash).toBe(
      b.find((s) => s.name === 'clamp')!.contentHash
    );
  });
});

describe('extractSymbols — Python evidence', () => {
  it('captures classes, methods and docstrings region', async () => {
    const tree = (await parseCode(PY_SAMPLE, 'python'))!;
    const language = await getLanguage('python');
    const symbols = extractSymbols(tree, language, 'python', PY_SAMPLE);

    const userService = symbols.find((s) => s.name === 'UserService');
    expect(userService).toBeDefined();
    expect(userService!.type).toBe('CLASS');
    expect(userService!.codeSnippet).toContain('def find');

    const find = symbols.find((s) => s.name === 'find');
    expect(find).toBeDefined();
    expect(find!.type).toBe('FUNCTION');
  });
});
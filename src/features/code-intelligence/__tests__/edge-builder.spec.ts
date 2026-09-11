import { describe, it, expect } from 'vitest';
import { parseCode, getLanguage } from '@/features/code-intelligence/parser';
import { extractEdges } from '@/features/code-intelligence/edge-builder';

const TS_SAMPLE = `
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function getSession(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = await db.user.findUnique({ where: { id: session.userId } });
  const data = await fetch('/api/data');
  return { user, data };
}
`;

const PY_SAMPLE = `
from users.service import UserService
import os

def get_user():
    svc = UserService()
    return svc.find("123")
`;

describe('extractEdges — TypeScript', () => {
  it('extracts IMPORTS with importPath metadata', async () => {
    const tree = (await parseCode(TS_SAMPLE, 'typescript'))!;
    const lang = await getLanguage('typescript');
    const edges = extractEdges(tree, lang, 'typescript');

    const imports = edges.filter((e) => e.type === 'IMPORTS');
    expect(imports.length).toBeGreaterThanOrEqual(2);

    const authImport = imports.find((e) => e.target === '@/lib/auth');
    expect(authImport).toBeDefined();
    expect(authImport!.metadata?.importPath).toBe('@/lib/auth');
    expect(authImport!.startLine).toBeGreaterThan(0);
  });

  it('extracts CALLS with expression metadata', async () => {
    const tree = (await parseCode(TS_SAMPLE, 'typescript'))!;
    const lang = await getLanguage('typescript');
    const edges = extractEdges(tree, lang, 'typescript');

    const calls = edges.filter((e) => e.type === 'CALLS');
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const getServerSessionCall = calls.find((e) => e.target === 'getServerSession');
    expect(getServerSessionCall).toBeDefined();
    expect(getServerSessionCall!.metadata?.expression).toContain('getServerSession');
    expect(getServerSessionCall!.startLine).toBeGreaterThan(0);
  });

  it('identifies FETCHES_ROUTE for fetch() calls', async () => {
    const tree = (await parseCode(TS_SAMPLE, 'typescript'))!;
    const lang = await getLanguage('typescript');
    const edges = extractEdges(tree, lang, 'typescript');

    const fetchRoute = edges.find((e) => e.type === 'FETCHES_ROUTE');
    expect(fetchRoute).toBeDefined();
    expect(fetchRoute!.target).toBe('fetch');
  });
});

describe('extractEdges — Python', () => {
  it('extracts IMPORTS and CALLS from Python source', async () => {
    const tree = (await parseCode(PY_SAMPLE, 'python'))!;
    const lang = await getLanguage('python');
    const edges = extractEdges(tree, lang, 'python');

    const imports = edges.filter((e) => e.type === 'IMPORTS');
    expect(imports.length).toBeGreaterThanOrEqual(2);

    const serviceImport = imports.find((e) => e.target.includes('users.service'));
    expect(serviceImport).toBeDefined();

    const calls = edges.filter((e) => e.type === 'CALLS');
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const findCall = calls.find((e) => e.target === 'find');
    expect(findCall).toBeDefined();
    expect(findCall!.metadata?.expression).toContain('find');
  });
});

describe('extractEdges — metadata capping', () => {
  it('caps very long expressions to 200 chars', async () => {
    const longCall = `
function f() {
  ${'a'.repeat(10)}(${ Array.from({ length: 20 }, () => `"${'x'.repeat(15)}"`).join(', ') });
}
`;
    const tree = (await parseCode(longCall, 'typescript'))!;
    const lang = await getLanguage('typescript');
    const edges = extractEdges(tree, lang, 'typescript');
    const calls = edges.filter((e) => e.type === 'CALLS');
    for (const call of calls) {
      if (call.metadata?.expression) {
        expect(call.metadata.expression.length).toBeLessThanOrEqual(204); // 200 + '...'
      }
    }
  });
});

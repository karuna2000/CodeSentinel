/**
 * Tests for the Version Signal Extractor.
 */

import { describe, it, expect } from 'vitest';
import {
  inferVersion,
  matchApiPatterns,
  findDeprecatedApis,
} from '@/features/version-grounding/version-signal-extractor';

// ─── React version inference ─────────────────────────────────────────────────

describe('inferVersion — React 18 detection', () => {
  it('infers React 18 from useTransition', () => {
    const code = `import { useState, useTransition } from 'react';
function App() {
  const [isPending, startTransition] = useTransition();
  return null;
}`;
    const result = inferVersion('React', code);
    expect(result.label).toContain('18');
    expect(result.confidence).toBeGreaterThan(0.60);
    expect(result.minVersion).toBe('18.0');
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('infers React 18 from createRoot', () => {
    const code = `import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);`;
    const result = inferVersion('React', code);
    expect(result.label).toContain('18');
    expect(result.confidence).toBeGreaterThan(0.55);
  });

  it('infers React 19 from use() hook', () => {
    const code = `import { use } from 'react';
function UserCard({ userPromise }) {
  const user = use(userPromise);
  return <div>{user.name}</div>;
}`;
    const result = inferVersion('React', code);
    expect(result.label).toContain('19');
    expect(result.confidence).toBeGreaterThan(0.55);
  });

  it('returns lower confidence when no version-specific signals', () => {
    const code = `import { useState } from 'react';
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}`;
    const result = inferVersion('React', code);
    // useState exists in React 16+ so confidence in a specific version should be lower
    expect(result.confidence).toBeLessThan(0.70);
  });
});

// ─── Next.js version inference ───────────────────────────────────────────────

describe('inferVersion — Next.js detection', () => {
  it('infers Next.js App Router (13+) from "use client"', () => {
    const code = `'use client';
import { useState } from 'react';
export default function Page() { return null; }`;
    const result = inferVersion('Next.js', code);
    expect(result.label).toContain('App Router');
    expect(result.confidence).toBeGreaterThan(0.60);
  });

  it('infers Next.js App Router from route handler export', () => {
    const code = `import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true });
}`;
    const result = inferVersion('Next.js', code);
    expect(result.label).toContain('App Router');
    expect(result.confidence).toBeGreaterThan(0.60);
  });

  it('infers Next.js Pages Router from getServerSideProps', () => {
    const code = `export async function getServerSideProps(ctx) {
  return { props: { data: [] } };
}
export default function Page({ data }) { return null; }`;
    const result = inferVersion('Next.js', code);
    expect(result.label).toContain('12');
    expect(result.minVersion).toBe('12.0');
  });
});

// ─── Unknown framework ────────────────────────────────────────────────────────

describe('inferVersion — unregistered framework', () => {
  it('returns low-confidence generic result for unknown frameworks', () => {
    const result = inferVersion('SomeObscureFramework', 'const x = 1;');
    expect(result.label).toContain('version unknown');
    expect(result.confidence).toBeLessThan(0.30);
    expect(result.minVersion).toBeNull();
    expect(result.maxVersion).toBeNull();
    expect(result.signals).toHaveLength(0);
  });
});

// ─── API pattern matching ─────────────────────────────────────────────────────

describe('matchApiPatterns — React', () => {
  it('detects useTransition for React 18', () => {
    const code = `const [pending, start] = useTransition();`;
    const matches = matchApiPatterns('React', code);
    expect(matches.some((m) => m.api === 'useTransition()')).toBe(true);
  });

  it('detects useDeferredValue for React 18', () => {
    const code = `const deferred = useDeferredValue(value);`;
    const matches = matchApiPatterns('React', code);
    expect(matches.some((m) => m.api === 'useDeferredValue()')).toBe(true);
  });

  it('returns empty array when no patterns match', () => {
    const code = `const add = (a, b) => a + b;`;
    const matches = matchApiPatterns('React', code);
    expect(matches).toHaveLength(0);
  });
});

describe('matchApiPatterns — Next.js', () => {
  it('detects "use client" directive', () => {
    const code = `'use client';
import { useState } from 'react';`;
    const matches = matchApiPatterns('Next.js', code);
    expect(matches.some((m) => m.api === '"use client"')).toBe(true);
  });

  it('detects generateStaticParams', () => {
    const code = `export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }];
}`;
    const matches = matchApiPatterns('Next.js', code);
    expect(matches.some((m) => m.api === 'generateStaticParams()')).toBe(true);
  });
});

// ─── Deprecated API detection ────────────────────────────────────────────────

describe('findDeprecatedApis', () => {
  it('flags ReactDOM.render as deprecated', () => {
    const code = `import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));`;
    const deprecated = findDeprecatedApis(code);
    expect(deprecated.some((p) => p.api === 'ReactDOM.render()')).toBe(true);
  });

  it('returns empty array for modern-only code', () => {
    const code = `import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);`;
    const deprecated = findDeprecatedApis(code);
    expect(deprecated).toHaveLength(0);
  });

  it('flags Vue 2 new Vue() as deprecated', () => {
    const code = `new Vue({
  el: '#app',
  render: h => h(App),
})`;
    const deprecated = findDeprecatedApis(code);
    expect(deprecated.some((p) => p.api === 'new Vue()')).toBe(true);
  });
});

/**
 * Tests for the Artifact Classifier.
 */

import { describe, it, expect } from 'vitest';
import { classifyArtifact } from '@/features/code-understanding/pipeline/artifact-classifier';

describe('classifyArtifact — test file', () => {
  it('classifies test files from describe/it/expect', () => {
    const code = `import { describe, it, expect } from 'vitest';
describe('my suite', () => {
  it('does something', () => {
    expect(1 + 1).toBe(2);
  });
});`;
    const result = classifyArtifact(code, 'utils.spec.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('test-file');
    expect(result!.confidence).toBeGreaterThan(0.75);
  });
});

describe('classifyArtifact — React component', () => {
  it('classifies React component from PascalCase export + JSX', () => {
    const code = `import { useState } from 'react';
interface ButtonProps { label: string; onClick: () => void; }
export default function Button({ label, onClick }: ButtonProps) {
  const [active, setActive] = useState(false);
  return <button onClick={onClick}>{label}</button>;
}`;
    const result = classifyArtifact(code, 'Button.tsx');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('react-component');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('classifyArtifact — hook', () => {
  it('classifies custom hooks from useXxx export pattern', () => {
    const code = `import { useState, useEffect } from 'react';
export function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}`;
    const result = classifyArtifact(code, 'useWindowSize.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hook');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('classifyArtifact — API route', () => {
  it('classifies Next.js App Router route handler', () => {
    const code = `import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) {
  return NextResponse.json({ users: [] });
}
export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ created: body });
}`;
    const result = classifyArtifact(code, 'route.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('api-route');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('classifyArtifact — auth module', () => {
  it('classifies auth module from jwt/signIn usage', () => {
    const code = `import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
export async function authenticate(email: string, password: string) {
  const user = await findUser(email);
  if (!user || !await bcrypt.compare(password, user.hash)) throw new Error('Invalid');
  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
  return { accessToken };
}`;
    const result = classifyArtifact(code, 'auth.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('auth-module');
    expect(result!.confidence).toBeGreaterThan(0.68);
  });
});

describe('classifyArtifact — schema/model', () => {
  it('classifies Zod schema file', () => {
    const code = `import { z } from 'zod';
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});
export type User = z.infer<typeof UserSchema>;`;
    const result = classifyArtifact(code, 'user.schema.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('schema-model');
  });
});

describe('classifyArtifact — middleware', () => {
  it('classifies Next.js middleware file', () => {
    const code = `import { NextResponse } from 'next/server';
export function middleware(req) {
  const token = req.cookies.get('token');
  if (!token) return NextResponse.redirect('/login');
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*'] };`;
    const result = classifyArtifact(code, 'middleware.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('middleware');
  });
});

describe('classifyArtifact — returns null for ambiguous files', () => {
  it('returns null or low confidence for very short generic files', () => {
    const code = `// TODO: implement`;
    const result = classifyArtifact(code, 'todo.ts');
    if (result !== null) {
      expect(result.confidence).toBeLessThan(0.60);
    }
  });
});

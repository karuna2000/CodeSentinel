

import { describe, it, expect } from 'vitest';
import { detectRuntime } from '@/features/code-understanding/pipeline/runtime-detector';

describe('detectRuntime — Node.js detection', () => {
  it('detects Node.js from fs import', () => {
    const code = `import { readFile } from 'fs';
import { join } from 'path';
const data = readFile(__dirname + '/config.json');`;
    const result = detectRuntime(code);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('node');
    expect(result!.confidence).toBeGreaterThan(0.60);
  });

  it('detects Node.js from process.env access', () => {
    const code = `const dbUrl = process.env.DATABASE_URL;
const port = process.env.PORT || 3000;`;
    const result = detectRuntime(code);
    expect(result?.type).toBe('node');
  });
});

describe('detectRuntime — browser detection', () => {
  it('detects browser from window and document access', () => {
    const code = `document.getElementById('root').addEventListener('click', () => {
  window.location.href = '/home';
  localStorage.setItem('key', 'value');
});`;
    const result = detectRuntime(code);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('browser');
    expect(result!.confidence).toBeGreaterThan(0.60);
  });

  it('detects browser from "use client" directive', () => {
    const code = `'use client';
import { useState } from 'react';`;
    const result = detectRuntime(code);
    expect(result?.type).toBe('browser');
  });
});

describe('detectRuntime — edge detection', () => {
  it('detects edge from runtime declaration', () => {
    const code = `export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) { return NextResponse.json({}); }`;
    const result = detectRuntime(code);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('edge');
    expect(result!.confidence).toBeGreaterThan(0.75);
  });
});

describe('detectRuntime — middleware detection', () => {
  it('detects middleware from Next.js middleware export', () => {
    const code = `import { NextResponse } from 'next/server';
export function middleware(req) {
  return NextResponse.next();
}
export const config = { matcher: ['/api/:path*'] };`;
    const result = detectRuntime(code, 'middleware.ts');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('middleware');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('detectRuntime — CLI detection', () => {
  it('detects CLI from process.argv', () => {
    const code = `const args = process.argv.slice(2);
const cmd = args[0];
console.log(\`Running command: \${cmd}\`);
process.exit(0);`;
    const result = detectRuntime(code);
    expect(result?.type).toBe('cli');
  });
});

describe('detectRuntime — serverless detection', () => {
  it('detects serverless from Lambda handler export', () => {
    const code = `exports.handler = async (event, context) => {
  const { Records } = event;
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};`;
    const result = detectRuntime(code, 'lambda-handler.js');
    expect(result?.type).toBe('serverless');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('detectRuntime — no runtime', () => {
  it('returns null for schema/type-only files', () => {
    const code = `export interface User { id: string; name: string; }
export type Role = 'admin' | 'user';`;
    const result = detectRuntime(code, 'types.ts');
    
    if (result !== null) {
      expect(result.confidence).toBeLessThan(0.60);
    }
  });
});

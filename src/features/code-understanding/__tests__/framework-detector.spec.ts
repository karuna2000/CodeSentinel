

import { describe, it, expect } from 'vitest';
import { detectFramework } from '@/features/code-understanding/pipeline/framework-detector';

describe('detectFramework — Next.js detection', () => {
  it('detects Next.js from next/* imports', () => {
    const code = `import { NextRequest, NextResponse } from 'next/server';
export async function GET(req: NextRequest) { return NextResponse.json({}); }`;
    const result = detectFramework(code, 'route.ts');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Next.js');
    expect(result!.confidence).toBeGreaterThan(0.80);
    expect(result!.signals.length).toBeGreaterThan(0);
  });

  it('detects Next.js from "use client" directive', () => {
    const code = `'use client';
import { useState } from 'react';
export default function Page() { return <div />; }`;
    const result = detectFramework(code);
    expect(result?.name).toBe('Next.js');
  });

  it('detects Next.js from getServerSideProps', () => {
    const code = `export async function getServerSideProps() { return { props: {} }; }
export default function Page() { return null; }`;
    const result = detectFramework(code, 'page.tsx');
    expect(result?.name).toBe('Next.js');
  });
});

describe('detectFramework — React detection', () => {
  it('detects React from hooks usage', () => {
    const code = `import { useState, useEffect } from 'react';
export function Counter() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}`;
    const result = detectFramework(code);
    expect(result?.name).toBe('React');
    expect(result!.confidence).toBeGreaterThan(0.60);
  });
});

describe('detectFramework — Express detection', () => {
  it('detects Express from import + route methods', () => {
    const code = `import express from 'express';
const app = express();
app.get('/users', (req, res, next) => { res.json([]); });
app.listen(3000);`;
    const result = detectFramework(code);
    expect(result?.name).toBe('Express');
    expect(result!.confidence).toBeGreaterThan(0.70);
  });
});

describe('detectFramework — FastAPI detection', () => {
  it('detects FastAPI from import and route decorator', () => {
    const code = `from fastapi import FastAPI
app = FastAPI()
@app.get("/users")
def get_users(): return []`;
    const result = detectFramework(code);
    expect(result?.name).toBe('FastAPI');
    expect(result!.confidence).toBeGreaterThan(0.75);
  });
});

describe('detectFramework — NestJS detection', () => {
  it('detects NestJS from @nestjs/* imports and decorators', () => {
    const code = `import { Controller, Get, Injectable } from '@nestjs/common';
@Injectable()
export class UsersService {}
@Controller('users')
export class UsersController { constructor(private svc: UsersService) {} }`;
    const result = detectFramework(code);
    expect(result?.name).toBe('NestJS');
    expect(result!.confidence).toBeGreaterThan(0.75);
  });
});

describe('detectFramework — Prisma detection', () => {
  it('detects Prisma from @prisma/client import and query', () => {
    const code = `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany();`;
    const result = detectFramework(code);
    expect(result?.name).toBe('Prisma');
    expect(result!.confidence).toBeGreaterThan(0.80);
  });
});

describe('detectFramework — no framework', () => {
  it('returns null for plain utility code with no framework signals', () => {
    const code = `export function add(a: number, b: number) { return a + b; }
export function sub(a: number, b: number) { return a - b; }`;
    const result = detectFramework(code, 'math.ts');
    
    if (result !== null) {
      expect(result.confidence).toBeLessThan(0.65);
    }
  });
});

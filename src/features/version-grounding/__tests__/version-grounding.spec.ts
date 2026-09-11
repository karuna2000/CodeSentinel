

import { describe, it, expect } from 'vitest';
import { runVersionGrounding } from '@/features/version-grounding';

const REACT18_CODE = `import { useState, useTransition, createRoot } from 'react';
import { createRoot } from 'react-dom/client';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  return (
    <input
      value={query}
      onChange={(e) => startTransition(() => setQuery(e.target.value))}
    />
  );
}`;

const NEXTJS_APP_ROUTER_CODE = `'use client';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const metadata = { title: 'Users' };

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await prisma.user.findMany();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const user = await prisma.user.create({ data: body });
  return NextResponse.json({ user }, { status: 201 });
}`;

describe('runVersionGrounding — empty frameworks', () => {
  it('returns empty output when no frameworks passed', () => {
    const output = runVersionGrounding([], REACT18_CODE);
    expect(output.frameworks).toHaveLength(0);
    expect(output.groundingSources).toHaveLength(0);
    expect(output.requiresVersionClarification).toBe(false);
    expect(output.detectedApiPatterns).toHaveLength(0);
    expect(output.groundingSummary).toContain('No frameworks');
  });
});

describe('runVersionGrounding — React 18 scenario', () => {
  it('detects React 18.x version', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    expect(output.frameworks).toHaveLength(1);
    const react = output.frameworks[0];
    expect(react.framework).toBe('React');
    expect(react.versionInference.label).toContain('18');
    expect(react.versionInference.confidence).toBeGreaterThan(0.55);
  });

  it('includes React 18 API patterns', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    const react = output.frameworks[0];
    expect(react.apiPatterns.some((p) => p.api === 'useTransition()')).toBe(true);
  });

  it('includes grounding sources for React', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    expect(output.groundingSources.length).toBeGreaterThan(0);
    expect(output.groundingSources.some((s) => s.url.includes('react.dev'))).toBe(true);
  });

  it('does not require version clarification for high-confidence React 18 detection', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    
    const react = output.frameworks[0];
    if (react.versionInference.confidence >= 0.60) {
      expect(react.versionClarificationQuestions).toHaveLength(0);
    }
  });
});

describe('runVersionGrounding — Next.js App Router + Prisma', () => {
  it('detects Next.js App Router version', () => {
    const output = runVersionGrounding(['Next.js', 'Prisma'], NEXTJS_APP_ROUTER_CODE);
    const next = output.frameworks.find((f) => f.framework === 'Next.js');
    expect(next).toBeDefined();
    expect(next!.versionInference.label).toContain('App Router');
  });

  it('detects Prisma framework entry', () => {
    const output = runVersionGrounding(['Next.js', 'Prisma'], NEXTJS_APP_ROUTER_CODE);
    const prisma = output.frameworks.find((f) => f.framework === 'Prisma');
    expect(prisma).toBeDefined();
  });

  it('merges grounding sources from multiple frameworks', () => {
    const output = runVersionGrounding(['Next.js', 'Prisma'], NEXTJS_APP_ROUTER_CODE);
    
    expect(output.groundingSources.length).toBeGreaterThan(2);
  });

  it('produces a non-empty grounding summary', () => {
    const output = runVersionGrounding(['Next.js'], NEXTJS_APP_ROUTER_CODE);
    expect(output.groundingSummary.length).toBeGreaterThan(0);
    expect(output.groundingSummary).not.toContain('No frameworks');
  });
});

describe('runVersionGrounding — output shape', () => {
  it('always has all required fields', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    expect(output).toHaveProperty('frameworks');
    expect(output).toHaveProperty('detectedApiPatterns');
    expect(output).toHaveProperty('requiresVersionClarification');
    expect(output).toHaveProperty('versionClarificationQuestions');
    expect(output).toHaveProperty('groundingSources');
    expect(output).toHaveProperty('groundingSummary');
  });

  it('frameworks is always an array', () => {
    const output = runVersionGrounding(['React'], REACT18_CODE);
    expect(Array.isArray(output.frameworks)).toBe(true);
  });

  it('groundingSources are sorted by priority', () => {
    const output = runVersionGrounding(['React', 'Next.js'], NEXTJS_APP_ROUTER_CODE);
    for (let i = 1; i < output.groundingSources.length; i++) {
      expect(output.groundingSources[i].priority).toBeGreaterThanOrEqual(
        output.groundingSources[i - 1].priority,
      );
    }
  });

  it('versionClarificationQuestions is capped at 2', () => {
    
    const output = runVersionGrounding(
      ['React', 'Vue', 'Express', 'NestJS', 'FastAPI'],
      'const x = 1;', 
    );
    expect(output.versionClarificationQuestions.length).toBeLessThanOrEqual(2);
  });
});

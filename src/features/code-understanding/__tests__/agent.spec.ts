/**
 * Integration tests for the Code Understanding Agent (full pipeline).
 * Tests runCodeUnderstandingAgent() end-to-end with realistic code samples.
 */

import { describe, it, expect } from 'vitest';
import { runCodeUnderstandingAgent } from '@/features/code-understanding/agent';
import type { InputArtifact } from '@/types/artifact';

function makeArtifact(overrides: Partial<InputArtifact> & { content: string }): InputArtifact {
  return {
    id: 'test-artifact-001',
    source: 'upload',
    filename: overrides.filename ?? 'test-file.ts',
    language: overrides.language ?? 'TypeScript',
    content: overrides.content,
    byteSize: new Blob([overrides.content]).size,
    lineCount: overrides.content.split('\n').length,
    formattedSize: '1.0 KB',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const NEXT_ROUTE_CODE = `import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const runtime = 'nodejs';

const prisma = new PrismaClient();

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await prisma.user.findMany();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = CreateUserSchema.parse(body);
  const user = await prisma.user.create({ data });
  return NextResponse.json({ user }, { status: 201 });
}`;

describe('runCodeUnderstandingAgent — Next.js route handler', () => {
  it('detects TypeScript language', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.language.name).toBe('TypeScript');
    expect(output.language.confidence).toBeGreaterThan(0.90);
  });

  it('detects Next.js framework', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.framework).not.toBeNull();
    expect(output.framework!.name).toBe('Next.js');
  });

  it('detects authentication signal', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.architecturalSignals.some((s) => s.name === 'authentication')).toBe(true);
  });

  it('detects database signal', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.architecturalSignals.some((s) => s.name === 'database')).toBe(true);
  });

  it('extracts key dependencies', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.dependencies).toContain('next/server');
    expect(output.dependencies).toContain('next-auth');
    expect(output.dependencies).toContain('@prisma/client');
    expect(output.dependencies).toContain('zod');
  });

  it('produces a non-empty summary string', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(typeof output.summary).toBe('string');
    expect(output.summary.length).toBeGreaterThan(10);
  });

  it('produces a valid overall confidence', () => {
    const artifact = makeArtifact({ content: NEXT_ROUTE_CODE, filename: 'route.ts' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(output.overallConfidence).toBeLessThanOrEqual(1);
  });
});

describe('runCodeUnderstandingAgent — unknown/ambiguous content', () => {
  it('returns Unknown language with low confidence for gibberish', () => {
    const artifact = makeArtifact({
      content: 'asdfjkl qwerty dvorak xyzzy plugh',
      filename: 'mystery',
      language: '',
    });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.language.name).toBe('Unknown');
    expect(output.language.confidence).toBeLessThan(0.40);
  });

  it('requires clarification for ambiguous/unknown content', () => {
    const artifact = makeArtifact({
      content: 'asdfjkl qwerty dvorak',
      filename: 'mystery',
      language: '',
    });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output.requiresClarification).toBe(true);
    expect(output.clarificationQuestions.length).toBeGreaterThan(0);
  });
});

describe('runCodeUnderstandingAgent — output shape', () => {
  it('always returns all required fields', () => {
    const artifact = makeArtifact({ content: 'const x = 1;', filename: 'x.js' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(output).toHaveProperty('language');
    expect(output).toHaveProperty('framework');
    expect(output).toHaveProperty('runtime');
    expect(output).toHaveProperty('artifactType');
    expect(output).toHaveProperty('dependencies');
    expect(output).toHaveProperty('architecturalSignals');
    expect(output).toHaveProperty('overallConfidence');
    expect(output).toHaveProperty('requiresClarification');
    expect(output).toHaveProperty('clarificationQuestions');
    expect(output).toHaveProperty('summary');
    expect(output).toHaveProperty('versionGrounding');
  });

  it('dependencies is always an array', () => {
    const artifact = makeArtifact({ content: 'const x = 1;', filename: 'x.js' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(Array.isArray(output.dependencies)).toBe(true);
  });

  it('architecturalSignals is always an array', () => {
    const artifact = makeArtifact({ content: 'const x = 1;', filename: 'x.js' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(Array.isArray(output.architecturalSignals)).toBe(true);
  });

  it('clarificationQuestions is always an array', () => {
    const artifact = makeArtifact({ content: 'const x = 1;', filename: 'x.js' });
    const output = runCodeUnderstandingAgent(artifact);
    expect(Array.isArray(output.clarificationQuestions)).toBe(true);
  });
});

describe('runCodeUnderstandingAgent — audit-engine integration', () => {
  it('attaches codeUnderstanding to ProcessingResult via processPayload', async () => {
    const { processPayload } = await import('@/features/audit-dashboard/services/audit-engine');
    const { normalizePayload } = await import('@/features/audit-dashboard/utils/payload-scrubber');
    const payload = normalizePayload(NEXT_ROUTE_CODE, 'route.ts', 'file-upload');
    const result = processPayload(payload);
    expect(result.codeUnderstanding).not.toBeNull();
    expect(result.codeUnderstanding!.language.name).toBe('TypeScript');
    expect(result.codeUnderstanding!.framework?.name).toBe('Next.js');
  });
});

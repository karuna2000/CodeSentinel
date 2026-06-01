

import { describe, it, expect } from 'vitest';
import { artifactFromProcessingResult } from '@/types/artifact';
import { normalizePayload } from '@/features/audit-dashboard/utils/payload-scrubber';
import { processPayload } from '@/features/audit-dashboard/services/audit-engine';

const SAMPLE_CODE = `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AuthService {\n  login() { return true; }\n}`;

function makeResult(code = SAMPLE_CODE, filename = 'auth.service.ts') {
  const payload = normalizePayload(code, filename, 'file-upload');
  return processPayload(payload);
}

describe('artifactFromProcessingResult', () => {
  it('creates an artifact with source "upload" for file uploads', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.source).toBe('upload');
  });

  it('creates an artifact with source "paste" for paste inputs', () => {
    const payload = normalizePayload(SAMPLE_CODE, 'pasted-input.ts', 'paste');
    const result = processPayload(payload);
    const artifact = artifactFromProcessingResult(result, 'paste');
    expect(artifact.source).toBe('paste');
  });

  it('preserves the filename from the payload', () => {
    const result = makeResult(SAMPLE_CODE, 'my-service.ts');
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.filename).toBe('my-service.ts');
  });

  it('preserves the language from the payload', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.language).toBe('TypeScript');
  });

  it('preserves the lineCount from the payload', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.lineCount).toBe(result.payload.lineCount);
  });

  it('preserves the formattedSize from the processing result', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.formattedSize).toBe(result.formattedSize);
  });

  it('generates a unique id for each artifact', () => {
    const result = makeResult();
    const a1 = artifactFromProcessingResult(result, 'upload');
    const a2 = artifactFromProcessingResult(result, 'upload');
    expect(a1.id).not.toBe(a2.id);
  });

  it('sets a valid ISO createdAt timestamp', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(() => new Date(artifact.createdAt)).not.toThrow();
    expect(new Date(artifact.createdAt).toISOString()).toBe(artifact.createdAt);
  });

  it('contains the original content', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.content).toBe(SAMPLE_CODE);
  });

  it('byteSize is positive for non-empty content', () => {
    const result = makeResult();
    const artifact = artifactFromProcessingResult(result, 'upload');
    expect(artifact.byteSize).toBeGreaterThan(0);
  });
});

/**
 * Tests for the audit engine (processPayload).
 * Covers: code line parsing, HTML escaping, pin initialisation, metadata pass-through.
 */

import { describe, it, expect } from 'vitest';
import { processPayload } from '@/features/audit-dashboard/services/audit-engine';
import { normalizePayload } from '@/features/audit-dashboard/utils/payload-scrubber';

const SAMPLE_CODE = `import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  login(email: string, password: string) {
    return email === password; // bad comparison
  }
}`;

function makePayload(code: string, filename = 'auth.service.ts') {
  return normalizePayload(code, filename, 'file-upload');
}

// ---------------------------------------------------------------------------
// processPayload — code lines
// ---------------------------------------------------------------------------
describe('processPayload — codeLines', () => {
  it('produces one CodeLine per line of the source content', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    const expectedLines = SAMPLE_CODE.split('\n').length;
    expect(result.codeLines).toHaveLength(expectedLines);
  });

  it('assigns sequential line numbers starting at 1', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    result.codeLines.forEach((line, i) => {
      expect(line.num).toBe(i + 1);
    });
  });

  it('HTML-escapes angle brackets in code lines', () => {
    const code = 'const generic = new Map<string, number>();';
    const payload = makePayload(code, 'test.ts');
    const result = processPayload(payload);
    expect(result.codeLines[0].code).toContain('&lt;');
    expect(result.codeLines[0].code).toContain('&gt;');
    expect(result.codeLines[0].code).not.toContain('<string');
  });

  it('HTML-escapes ampersands in code lines', () => {
    const code = 'if (a && b) { return true; }';
    const payload = makePayload(code, 'test.ts');
    const result = processPayload(payload);
    expect(result.codeLines[0].code).toContain('&amp;&amp;');
  });

  it('handles Windows-style CRLF line endings', () => {
    const code = 'const a = 1;\r\nconst b = 2;\r\nconst c = 3;';
    const payload = makePayload(code, 'win.ts');
    const result = processPayload(payload);
    expect(result.codeLines).toHaveLength(3);
  });

  it('handles single-line content without errors', () => {
    const payload = makePayload('const x = 42;', 'single.ts');
    const result = processPayload(payload);
    expect(result.codeLines).toHaveLength(1);
    expect(result.codeLines[0].num).toBe(1);
  });

  it('preserves empty lines as empty code strings', () => {
    const code = 'line1\n\nline3';
    const payload = makePayload(code, 'gaps.ts');
    const result = processPayload(payload);
    expect(result.codeLines[1].code).toBe('');
  });
});

// ---------------------------------------------------------------------------
// processPayload — pins
// ---------------------------------------------------------------------------
describe('processPayload — pins', () => {
  it('returns an empty pins object (AI enrichment stage pending)', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    expect(result.pins).toEqual({});
    expect(Object.keys(result.pins)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// processPayload — metadata pass-through
// ---------------------------------------------------------------------------
describe('processPayload — metadata', () => {
  it('passes the original payload reference through unchanged', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    expect(result.payload).toBe(payload);
  });

  it('includes a formatted size string', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    expect(typeof result.formattedSize).toBe('string');
    expect(result.formattedSize.length).toBeGreaterThan(0);
  });

  it('formatted size is non-zero for non-empty content', () => {
    const payload = makePayload(SAMPLE_CODE);
    const result = processPayload(payload);
    expect(result.formattedSize).not.toBe('0 B');
  });
});

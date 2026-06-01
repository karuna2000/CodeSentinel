

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectLanguage,
  extractExtension,
  formatByteSize,
  normalizePayload,
  readFileAsync,
} from '@/features/audit-dashboard/utils/payload-scrubber';

describe('extractExtension', () => {
  it('returns the extension with dot for standard filenames', () => {
    expect(extractExtension('auth.service.ts')).toBe('.ts');
    expect(extractExtension('index.jsx')).toBe('.jsx');
    expect(extractExtension('main.py')).toBe('.py');
  });

  it('returns empty string for filenames without extension', () => {
    expect(extractExtension('Makefile')).toBe('');
    expect(extractExtension('Dockerfile')).toBe('');
  });

  it('returns empty string for trailing dot', () => {
    expect(extractExtension('file.')).toBe('');
  });

  it('handles uppercase extensions by lowercasing', () => {
    expect(extractExtension('App.TS')).toBe('.ts');
    expect(extractExtension('Hello.PY')).toBe('.py');
  });
});

describe('detectLanguage', () => {
  it('maps known extensions to human-readable language labels', () => {
    expect(detectLanguage('.ts')).toBe('TypeScript');
    expect(detectLanguage('.tsx')).toBe('TypeScript / React');
    expect(detectLanguage('.py')).toBe('Python');
    expect(detectLanguage('.go')).toBe('Go');
    expect(detectLanguage('.rs')).toBe('Rust');
    expect(detectLanguage('.sql')).toBe('SQL');
    expect(detectLanguage('.yaml')).toBe('YAML');
    expect(detectLanguage('.yml')).toBe('YAML');
  });

  it('returns "Unknown" for unrecognised extensions', () => {
    expect(detectLanguage('.xyz')).toBe('Unknown');
    expect(detectLanguage('')).toBe('Unknown');
    expect(detectLanguage('.docx')).toBe('Unknown');
  });
});

describe('formatByteSize', () => {
  it('formats bytes under 1024 as "N B"', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(1023)).toBe('1023 B');
  });

  it('formats bytes in the KB range', () => {
    expect(formatByteSize(1024)).toBe('1.0 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
    expect(formatByteSize(51200)).toBe('50.0 KB');
  });

  it('formats bytes in the MB range', () => {
    expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatByteSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('normalizePayload', () => {
  const sample = `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AuthService {}`;

  it('correctly counts lines', () => {
    const result = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    expect(result.lineCount).toBe(4);
  });

  it('detects language from the filename extension', () => {
    const result = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    expect(result.language).toBe('TypeScript');
  });

  it('preserves original content exactly', () => {
    const result = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    expect(result.content).toBe(sample);
  });

  it('records the correct source type', () => {
    const fileResult = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    const pasteResult = normalizePayload(sample, 'paste.txt', 'paste');
    expect(fileResult.source).toBe('file-upload');
    expect(pasteResult.source).toBe('paste');
  });

  it('computes a positive byteSize', () => {
    const result = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    expect(result.byteSize).toBeGreaterThan(0);
  });

  it('stores a valid ISO ingestedAt timestamp', () => {
    const result = normalizePayload(sample, 'auth.service.ts', 'file-upload');
    expect(() => new Date(result.ingestedAt)).not.toThrow();
    expect(new Date(result.ingestedAt).toISOString()).toBe(result.ingestedAt);
  });

  it('handles single-line content (lineCount === 1)', () => {
    const result = normalizePayload('const x = 1;', 'snippet.ts', 'text-input');
    expect(result.lineCount).toBe(1);
  });
});

describe('readFileAsync', () => {
  
  function makeFileReaderMock(resolvedText: string) {
    return class MockFileReader {
      result: string | null = null;
      onload: ((e: ProgressEvent) => void) | null = null;
      onerror: ((e: ProgressEvent) => void) | null = null;
      readAsText() {
        this.result = resolvedText;
        const event = { target: { result: resolvedText } } as unknown as ProgressEvent;
        if (this.onload) setTimeout(() => this.onload!(event), 0);
      }
    };
  }

  beforeEach(() => {
    
    vi.stubGlobal('FileReader', makeFileReaderMock('const hello = "world";\n'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a text File object and resolves with its string content', async () => {
    const content = 'const hello = "world";\n';
    vi.stubGlobal('FileReader', makeFileReaderMock(content));
    const file = new File([content], 'hello.ts', { type: 'text/plain' });
    const result = await readFileAsync(file);
    expect(result).toBe(content);
  });

  it('resolves with empty string for an empty file', async () => {
    vi.stubGlobal('FileReader', makeFileReaderMock(''));
    const file = new File([''], 'empty.ts', { type: 'text/plain' });
    const result = await readFileAsync(file);
    expect(result).toBe('');
  });

  it('correctly reads multi-line content', async () => {
    const code = `function add(a, b) {\n  return a + b;\n}\n`;
    vi.stubGlobal('FileReader', makeFileReaderMock(code));
    const file = new File([code], 'add.js', { type: 'text/plain' });
    const result = await readFileAsync(file);
    expect(result).toBe(code);
  });
});

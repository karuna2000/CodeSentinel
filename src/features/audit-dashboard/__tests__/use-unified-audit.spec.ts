

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { appStore, resetStoreForTesting } from '@/stores/app.store';

function resetStore() {
  resetStoreForTesting();
}

function makeTextFile(content: string, filename: string, type = 'text/plain'): File {
  return new File([content], filename, { type });
}

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

import { processPayload } from '@/features/audit-dashboard/services/audit-engine';
import { normalizePayload } from '@/features/audit-dashboard/utils/payload-scrubber';
import {
  validateFileSize,
  validateFileType,
  validatePasteContent,
} from '@/lib/validation';

describe('appStore — initial state', () => {
  beforeEach(resetStore);

  it('starts in idle state', () => {
    const state = appStore.getState();
    expect(state.processingState).toBe('idle');
  });

  it('starts with null payload and result', () => {
    const state = appStore.getState();
    expect(state.inputPayload).toBeNull();
    expect(state.processingResult).toBeNull();
  });

  it('starts with no validation error', () => {
    const state = appStore.getState();
    expect(state.validationError).toBeNull();
  });
});

describe('pipeline — file ingestion flow', () => {
  beforeEach(() => {
    resetStore();
    vi.stubGlobal('FileReader', makeFileReaderMock('const x = 1;\n'));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an oversized file at the validation stage', () => {
    
    const bigContent = 'x'.repeat(6 * 1024 * 1024);
    const file = makeTextFile(bigContent, 'big.ts');
    const sizeCheck = validateFileSize(file);
    expect(sizeCheck.valid).toBe(false);
    expect(sizeCheck.error).toContain('too large');
  });

  it('rejects an unsupported file type', () => {
    const file = makeTextFile('binary data', 'photo.png', 'image/png');
    
    const sizeCheck = validateFileSize(file);
    expect(sizeCheck.valid).toBe(true);
    const typeCheck = validateFileType(file);
    expect(typeCheck.valid).toBe(false);
    expect(typeCheck.error).toMatch(/not supported|multimedia/i);
  });

  it('accepts a valid TypeScript file and produces a ProcessingResult', () => {
    const content = `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AuthService {}`;
    const payload = normalizePayload(content, 'auth.service.ts', 'file-upload');
    const result = processPayload(payload);

    expect(result.payload.filename).toBe('auth.service.ts');
    expect(result.payload.language).toBe('TypeScript');
    expect(result.codeLines).toHaveLength(4);
    expect(result.pins).toEqual({});
  });

  it('produces a result with matching line count', () => {
    const content = 'line1\nline2\nline3\nline4\nline5';
    const payload = normalizePayload(content, 'test.ts', 'file-upload');
    const result = processPayload(payload);
    expect(result.codeLines).toHaveLength(5);
    expect(result.payload.lineCount).toBe(5);
  });
});

describe('pipeline — paste ingestion flow', () => {
  beforeEach(resetStore);

  it('rejects non-code prose via heuristic validation', () => {
    const prose = 'This is a long essay about the French Revolution and its impact on modern society. Napoleon was born in Corsica and went on to conquer much of Europe.';
    const check = validatePasteContent(prose);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('source code');
  });

  it('accepts valid code and produces a ProcessingResult', () => {
    const code = `const express = require('express');\nconst app = express();\napp.listen(3000);`;
    const check = validatePasteContent(code);
    expect(check.valid).toBe(true);

    const payload = normalizePayload(code, 'paste.txt', 'paste');
    const result = processPayload(payload);
    expect(result.payload.source).toBe('paste');
    expect(result.codeLines.length).toBeGreaterThan(0);
  });

  it('rejects content exceeding MAX_PASTE_BYTES', () => {
    
    const hugeCode = 'const x = 1;\n'.repeat(150000);
    const check = validatePasteContent(hugeCode);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('too large');
  });
});

describe('appStore — subscriber pattern', () => {
  beforeEach(resetStore);

  it('notifies subscribers when state changes', () => {
    const listener = vi.fn();
    const unsubscribe = appStore.subscribe(listener);

    appStore.setState({ processingState: 'processing' });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].processingState).toBe('processing');

    unsubscribe();
  });

  it('does not notify after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = appStore.subscribe(listener);
    unsubscribe();

    appStore.setState({ processingState: 'done' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('reflects the latest state via getState', () => {
    appStore.setState({ processingState: 'error', validationError: 'File too big' });
    const state = appStore.getState();
    expect(state.processingState).toBe('error');
    expect(state.validationError).toBe('File too big');
  });
});

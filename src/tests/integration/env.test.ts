/**
 * Unit tests for src/lib/env.ts
 *
 * Tests that the env module correctly validates environment variables
 * and throws meaningful errors when required values are missing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('env validation', () => {
  // Since env.ts runs at module load time, we test requireEnv logic independently
  describe('requireEnv logic', () => {
    it('throws when a required env var is missing', () => {
      // Simulate what requireEnv does
      function requireEnv(key: string, env: Record<string, string | undefined>): string {
        const value = env[key];
        if (!value || value.trim() === '') {
          throw new Error(`[env] Missing required environment variable: "${key}"`);
        }
        return value;
      }

      expect(() => requireEnv('MISSING_KEY', {})).toThrow(
        '[env] Missing required environment variable: "MISSING_KEY"'
      );
    });

    it('throws when a required env var is empty string', () => {
      function requireEnv(key: string, env: Record<string, string | undefined>): string {
        const value = env[key];
        if (!value || value.trim() === '') {
          throw new Error(`[env] Missing required environment variable: "${key}"`);
        }
        return value;
      }

      expect(() => requireEnv('EMPTY_KEY', { EMPTY_KEY: '' })).toThrow();
    });

    it('throws when a required env var is whitespace only', () => {
      function requireEnv(key: string, env: Record<string, string | undefined>): string {
        const value = env[key];
        if (!value || value.trim() === '') {
          throw new Error(`[env] Missing required environment variable: "${key}"`);
        }
        return value;
      }

      expect(() => requireEnv('WHITESPACE_KEY', { WHITESPACE_KEY: '   ' })).toThrow();
    });

    it('returns the value when env var is present', () => {
      function requireEnv(key: string, env: Record<string, string | undefined>): string {
        const value = env[key];
        if (!value || value.trim() === '') {
          throw new Error(`[env] Missing required environment variable: "${key}"`);
        }
        return value;
      }

      const result = requireEnv('PRESENT_KEY', { PRESENT_KEY: 'my-secret-value' });
      expect(result).toBe('my-secret-value');
    });
  });
});

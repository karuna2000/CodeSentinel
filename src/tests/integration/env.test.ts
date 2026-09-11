

import { describe, it, expect } from 'vitest';

describe('env validation', () => {
  
  describe('requireEnv logic', () => {
    it('throws when a required env var is missing', () => {
      
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

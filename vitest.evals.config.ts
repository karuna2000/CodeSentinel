import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/evals/**/*.eval.ts'],
    setupFiles: ['src/tests/setup/vitest.setup.ts'],
    // Evals call live LLM endpoints + the local DB; give them room to breathe.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
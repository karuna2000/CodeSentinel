// Global test setup — runs before every test file
// Mock Next.js server-only APIs that aren't available in vitest's node environment

import { beforeEach, afterEach, vi } from 'vitest';

// Silence console.error during tests unless explicitly testing for errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});

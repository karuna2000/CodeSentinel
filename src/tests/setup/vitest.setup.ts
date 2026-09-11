

import { beforeEach, afterEach, vi } from 'vitest';

process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test_github_client_id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'test_github_client_secret';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test_nextauth_secret_with_32_characters_min';
process.env.NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || 'test_nvidia_api_key';

const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});


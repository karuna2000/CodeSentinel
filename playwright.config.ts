import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3200);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    cwd: '.',
    url: `${BASE_URL}/auth/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: 'e2e-test-secret-do-not-use-in-prod',
      GITHUB_CLIENT_ID: 'e2e-test-client-id',
      GITHUB_CLIENT_SECRET: 'e2e-test-client-secret',
      NVIDIA_API_KEY: 'e2e-test-nvidia-key',
    },
  },
});
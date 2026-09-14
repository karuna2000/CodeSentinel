

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Missing required environment variable: "${key}"\n` +
      `Copy .env.example → .env.local and fill in the values.`
    );
  }
  return value;
}

export const env = {
  github: {
    clientId: requireEnv('GITHUB_CLIENT_ID'),
    clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
  },
  githubAppId: process.env.GITHUB_APP_ID || '',
  githubAppPrivateKey: (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  githubAppName: process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'codemine2026',
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
    host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  },
  upstash: {
    // Optional. When unset, rate limiting falls back to in-memory (dev/local).
    redisRestUrl: process.env.UPSTASH_REDIS_REST_URL || '',
    redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
  jobs: {
    // Optional. Guards POST /api/jobs/run (the background job cron endpoint).
    runSecret: process.env.JOBS_RUN_SECRET || '',
  },
  llm: {
    // Optional. Max LLM tokens a user may consume per day (input + output),
    // across review, chat and intent detection. 0/absent disables the cap.
    dailyTokenCap: Number(process.env.LLM_BUDGET_DAILY_TOKENS) || 0,
  },
  demo: {
    // Optional. Comma-separated repository ids served anonymously at /demo.
    // Empty = demo disabled (page + API return 404). Only allowlisted repos
    // are ever readable without a session; no write endpoints exist in scope.
    repoIds: (process.env.DEMO_REPO_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  nextAuth: {
    secret: requireEnv('NEXTAUTH_SECRET'),
    url: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  },
  nvidia: {
    apiKey: requireEnv('NVIDIA_API_KEY'),
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

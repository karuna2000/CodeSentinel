/**
 * Environment variable validation.
 * Throws at startup if required secrets are missing.
 */

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
  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  },
  nextAuth: {
    secret: requireEnv('NEXTAUTH_SECRET'),
    url: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

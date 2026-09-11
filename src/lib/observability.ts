import { Langfuse } from 'langfuse';
import { env } from '@/lib/env';

// Initialize Langfuse only if keys are present
export const langfuse =
  env.langfuse.publicKey && env.langfuse.secretKey
    ? new Langfuse({
        publicKey: env.langfuse.publicKey,
        secretKey: env.langfuse.secretKey,
        baseUrl: env.langfuse.host,
      })
    : null;

/**
 * Traces a custom event.
 */
export function traceEvent(name: string, metadata?: Record<string, unknown>) {
  if (langfuse) {
    langfuse.trace({
      name,
      metadata,
    });
  } else if (!env.isProduction) {
    // Optional console fallback for dev if needed
  }
}

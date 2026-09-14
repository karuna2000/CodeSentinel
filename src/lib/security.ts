import { timingSafeEqual } from 'crypto';
import { MAX_UPLOAD_BYTES } from './config';

const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 512 * 1024;

export function enforceContentLength(req: Request): Response | null {
  const contentLength = req.headers.get('content-length');
  if (contentLength !== null) {
    const bytes = parseInt(contentLength, 10);
    if (!isNaN(bytes) && bytes > MAX_REQUEST_BYTES) {
      return new Response(
        JSON.stringify({ error: `Request body too large. Maximum allowed is ${(MAX_REQUEST_BYTES / (1024 * 1024)).toFixed(1)} MB.` }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }
  return null;
}

export function buildUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized. You must be signed in to use this endpoint.' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );
}

export function buildRateLimitedResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({ error: `Rate limit exceeded. Try again in ${retryAfterSec}s.` }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
      },
    },
  );
}

/** Constant-time string compare. Different lengths return false without throwing. */
export function secureCompare(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

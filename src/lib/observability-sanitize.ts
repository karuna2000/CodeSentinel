/**
 * Telemetry sanitizer (spec §32–34, Phase 1 hardening).
 *
 * Single choke point for everything leaving the process toward observability
 * backends (Langfuse spans, traceEvent metadata). Rules:
 * - Blocked key patterns (case-insensitive): secrets, tokens, cookies, keys.
 * - Code-content keys (source/prompt/completion/context/…) are dropped
 *   unless explicit content capture is enabled via OBS_CAPTURE_CONTENT.
 * - Secret-shaped VALUES are redacted even under innocent keys (second line
 *   of defense; primary defense is never capturing content by default).
 */

const BLOCKED_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /access_token/i,
  /refresh_token/i,
  /private_key/i,
  /client_secret/i,
  /github_token/i,
  /password/i,
  /secret/i,
  /webhook_secret/i,
  /api[_-]?key/i,
];

const CONTENT_KEYS = [
  'source',
  'source_code',
  'file_content',
  'chunk_content',
  'prompt',
  'completion',
  'context',
  'answer',
  'query',
  'text',
];

const SECRET_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abpr]-([A-Za-z0-9-]{10,})\b/,
  /\bsk-(ant|proj|live)-[A-Za-z0-9-_]{10,}\b/,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+/i,
];

export interface SanitizeOptions {
  /** Explicit opt-in for raw content (dev only, never default). */
  allowContent?: boolean;
}

function isContentKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return CONTENT_KEYS.some((k) => normalized === k || normalized.endsWith(`_${k}`));
}

/** Deep-scrub a metadata object for telemetry export. Never throws. */
export function sanitizeTelemetryMetadata(
  input: Record<string, unknown>,
  opts: SanitizeOptions = {},
): Record<string, unknown> {
  const allowContent =
    opts.allowContent ?? process.env.OBS_CAPTURE_CONTENT === 'true';
  const out: Record<string, unknown> = {};
  try {
    for (const [key, value] of Object.entries(input ?? {})) {
      if (BLOCKED_KEY_PATTERNS.some((re) => re.test(key))) continue;
      if (!allowContent && isContentKey(key)) continue;
      out[key] = scrubValue(value, allowContent);
    }
  } catch {
    return {};
  }
  return out;
}

function scrubValue(value: unknown, allowContent: boolean): unknown {
  if (typeof value === 'string') {
    for (const re of SECRET_VALUE_PATTERNS) {
      if (re.test(value)) return '[REDACTED_SECRET]';
    }
    if (!allowContent && value.length > 500) {
      return `${value.slice(0, 200)}…[truncated ${value.length} chars]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => scrubValue(v, allowContent));
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeTelemetryMetadata(value as Record<string, unknown>, { allowContent });
  }
  return value;
}

/** Scrub an error for span recording / logging (messages may echo secrets). */
export function sanitizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  for (const re of SECRET_VALUE_PATTERNS) {
    if (re.test(message)) return '[REDACTED_SECRET]';
  }
  return message.slice(0, 500);
}

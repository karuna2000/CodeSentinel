import { createHash } from 'node:crypto';

/**
 * Client-IP handling for anonymous buckets (demo, metrics).
 *
 * `x-forwarded-for` is attacker-controlled when traffic reaches us directly,
 * so it must never be used verbatim as a map key or persisted: normalized to
 * a valid IP shape (else `unknown`) and hashed before storage.
 */

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/** First forwarded entry, validated to an IP shape or `unknown`. */
export function normalizeClientIp(header: string | null): string {
  const raw = (header?.split(',')[0]?.trim() ?? '').slice(0, 45);
  if (IPV4_RE.test(raw)) return raw;
  if (raw.includes(':') && IPV6_RE.test(raw)) return raw;
  return 'unknown';
}

/** Opaque, fixed-length identity for ledgers — raw IPs are never persisted. */
export function hashClientIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

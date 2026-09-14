import { NextResponse } from 'next/server';
import { ensureMetrics, registry } from '@/lib/metrics';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeClientIp } from '@/lib/request-ip';

/**
 * GET /api/metrics — Prometheus scrape endpoint (public).
 *
 * Only aggregate labels are exposed (intent/status/gate/result) — no user
 * ids, repo ids, or query text. Scrapes are IP-throttled so the endpoint
 * cannot be used for availability probing at line rate.
 */
export async function GET(request: Request) {
  const ip = normalizeClientIp(request.headers.get('x-forwarded-for'));
  const { allowed } = await checkRateLimit(`metrics:${ip}`, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const body = await ensureMetrics().metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': registry.contentType },
  });
}

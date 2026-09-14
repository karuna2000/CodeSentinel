import { NextResponse } from 'next/server';
import { ensureMetrics, registry } from '@/lib/metrics';

/**
 * GET /api/metrics — Prometheus scrape endpoint (public).
 *
 * Only aggregate labels are exposed (intent/status/gate/result) — no user
 * ids, repo ids, or query text. For exact per-user figures use the
 * session-scoped /admin/observability dashboard (Postgres-backed).
 */
export async function GET() {
  const body = await ensureMetrics().metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': registry.contentType },
  });
}

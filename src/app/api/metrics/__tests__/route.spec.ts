import { describe, expect, it } from 'vitest';
import { GET } from '../route';
import { registry } from '@/lib/metrics';

describe('GET /api/metrics', () => {
  it('returns 200 prometheus text without authentication', async () => {
    const res = await GET(new Request('http://localhost/api/metrics'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(registry.contentType);
    const body = await res.text();
    expect(body).toMatch(/codesintler_chat_answers_total/);
  });
});

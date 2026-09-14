import { describe, expect, it } from 'vitest';
import {
  BLOCKED_FALLBACK,
  checkCitationCoverage,
  extractCitedTags,
  runGuardrails,
  scanSecretsLeak,
} from '../services/guardrails';

const LONG_GROUNDED =
  'The verifyJWT function validates the token signature and expiry before attaching the session. ' +
  'See the middleware implementation for the exact checks performed on each request. [E1]';

const LONG_UNCITED =
  'The verifyJWT function validates the token signature and expiry before attaching the session. ' +
  'It runs inside the auth middleware on every request and rejects expired tokens with a 401 status.';

describe('extractCitedTags', () => {
  it('collects unique tags in order', () => {
    expect(extractCitedTags('See [E2] and [E1], also [E2] again')).toEqual(['E2', 'E1']);
  });

  it('ignores non-evidence brackets', () => {
    expect(extractCitedTags('array[0], [note], [E]')).toEqual([]);
  });
});

describe('checkCitationCoverage', () => {
  it('passes a cited substantive answer', () => {
    const r = checkCitationCoverage(LONG_GROUNDED, ['E1', 'E2'], 2);
    expect(r.pass).toBe(true);
  });

  it('fails a substantive answer with zero citations when evidence exists', () => {
    const r = checkCitationCoverage(LONG_UNCITED, ['E1'], 1);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/no evidence/i);
  });

  it('fails references to tags outside the evidence index', () => {
    const r = checkCitationCoverage('Hallucinated claim here [E9].', ['E1'], 1);
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/E9/);
  });

  it('exempts short conversational replies', () => {
    expect(checkCitationCoverage("You're welcome!", ['E1'], 2).pass).toBe(true);
  });

  it('passes uncited answers when no evidence was retrieved', () => {
    expect(checkCitationCoverage(LONG_UNCITED, [], 0).pass).toBe(true);
  });
});

describe('scanSecretsLeak', () => {
  it('passes answers that merely mention .env', () => {
    expect(scanSecretsLeak('Set the value in your .env file and restart.').pass).toBe(true);
  });

  it('blocks private key blocks', () => {
    expect(
      scanSecretsLeak('Here is the key:\n-----BEGIN RSA PRIVATE KEY-----\nabc').pass,
    ).toBe(false);
  });

  it.each([
    ['ghp_abcdefghijklmnopqrstuvwx', 'github-token'],
    ['AKIAIOSFODNN7EXAMPLE', 'aws-access-key'],
    ['api_key: sk-live-0123456789abcdef', 'api-key-value'],
  ])('blocks %s', (value) => {
    expect(scanSecretsLeak(`Use ${value} to connect.`).pass).toBe(false);
  });

  it('passes ordinary code discussion', () => {
    expect(
      scanSecretsLeak('The middleware reads process.env.GITHUB_APP_ID at startup. [E1]').pass,
    ).toBe(true);
  });
});

describe('runGuardrails', () => {
  it('passes clean grounded answers', () => {
    const v = runGuardrails(LONG_GROUNDED, { validTagIds: ['E1'], evidenceCount: 1 });
    expect(v.pass).toBe(true);
    expect(v.blocked).toBe(false);
    expect(v.citedTags).toEqual(['E1']);
  });

  it('blocks when any gate fails and exposes the fallback', () => {
    const v = runGuardrails(LONG_UNCITED, { validTagIds: ['E1'], evidenceCount: 1 });
    expect(v.pass).toBe(false);
    expect(v.blocked).toBe(true);
    expect(BLOCKED_FALLBACK.length).toBeGreaterThan(0);
  });
});

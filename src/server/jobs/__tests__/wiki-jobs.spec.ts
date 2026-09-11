import { describe, it, expect } from 'vitest';
import { verifyDrainAccess, STALE_JOB_MS } from '../wiki-jobs';

describe('verifyDrainAccess', () => {
  it('requires the exact secret header when a secret is configured', () => {
    expect(verifyDrainAccess('the-secret', 'the-secret', false)).toBe(true);
    expect(verifyDrainAccess('wrong', 'the-secret', false)).toBe(false);
    expect(verifyDrainAccess(null, 'the-secret', false)).toBe(false);
    expect(verifyDrainAccess(null, 'the-secret', true)).toBe(false);
  });

  it('only allows requests without a header in development when no secret is set', () => {
    expect(verifyDrainAccess(null, '', true)).toBe(true);
    expect(verifyDrainAccess(null, '', false)).toBe(false);
    expect(verifyDrainAccess('anything', '', true)).toBe(false);
  });

  it('never permits arbitrary headers in production', () => {
    expect(verifyDrainAccess('anything', '', false)).toBe(false);
  });
});

describe('STALE_JOB_MS', () => {
  it('is 30 minutes, matching the re-claim window', () => {
    expect(STALE_JOB_MS).toBe(30 * 60 * 1000);
  });
});
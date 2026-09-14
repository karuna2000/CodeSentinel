import { describe, expect, it } from 'vitest';
import { TelemetryEvent, eventContext } from '../observability-events';

describe('telemetry event taxonomy', () => {
  it('exposes a closed vocabulary of dot-separated names', () => {
    const names = Object.values(TelemetryEvent);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toMatch(/^[a-z]+(\.[a-z]+)+$/);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('merges the event name with caller context', () => {
    expect(
      eventContext(TelemetryEvent.RepositoryDeleted, { repoId: 'r1' }),
    ).toEqual({ 'event.name': 'repository.deleted', repoId: 'r1' });
  });
});

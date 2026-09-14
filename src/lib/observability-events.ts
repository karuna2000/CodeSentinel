/**
 * Stable dot-separated telemetry event names (spec §8.4, §13.1).
 *
 * Use `event.name` in log context instead of inventing ad-hoc strings, so
 * SigNoz can filter/group on a closed vocabulary. One name per event —
 * never `repo_delete` vs `repository.deleted` variants.
 */

export const TelemetryEvent = {
  RepositoryConnected: 'repository.connected',
  RepositoryDeleted: 'repository.deleted',
  RepositoryIndexingStarted: 'repository.indexing.started',
  RepositoryIndexingCompleted: 'repository.indexing.completed',
  RepositoryIndexingFailed: 'repository.indexing.failed',
  RepositoryWikiStarted: 'repository.wiki.started',
  RepositoryWikiCompleted: 'repository.wiki.completed',
  RepositoryWikiFailed: 'repository.wiki.failed',
  AgentQueryCompleted: 'agent.query.completed',
  AgentQueryFailed: 'agent.query.failed',
} as const;

export type TelemetryEventName =
  (typeof TelemetryEvent)[keyof typeof TelemetryEvent];

/** Context fragment attaching the canonical event name to a log record. */
export function eventContext(
  eventName: TelemetryEventName,
  context: Record<string, unknown> = {},
): Record<string, unknown> {
  return { 'event.name': eventName, ...context };
}

// ─── Common utility types used across the app ──────────────────────────────

/** Next.js 15 App Router searchParams (async) */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Generic paginated response wrapper */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

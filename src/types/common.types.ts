

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

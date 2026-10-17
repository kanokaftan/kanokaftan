import type { Json } from "@/integrations/supabase/types";

/** Rows per page on the admin lists. */
export const ADMIN_PAGE_SIZE = 50;
/** The admin_list_* functions never return more than this many rows per call. */
export const ADMIN_MAX_PAGE_SIZE = 200;
/** How long the search box waits after the last keystroke before asking the server. */
export const ADMIN_SEARCH_DEBOUNCE_MS = 300;
/** Lists are refetched after a mutation, so a short stale time is enough. */
export const ADMIN_LIST_STALE_TIME_MS = 30_000;
/** Safety stop for "fetch every row" loops (200 × 50 = 10,000 rows). */
const MAX_FETCH_ALL_PAGES = 50;

/** What an admin list asks the server for. `page` is 1-based. */
export interface AdminListParams<F extends string> {
  search?: string;
  filter?: F;
  page?: number;
  pageSize?: number;
}

/** One page of an admin list plus the number of rows matching the search and filter. */
export interface AdminListPage<T> {
  total: number;
  rows: T[];
}

export interface ResolvedListParams<F extends string> {
  search: string;
  filter: F;
  page: number;
  pageSize: number;
}

/** Fills in defaults so equal requests share one react-query cache entry. */
export function resolveListParams<F extends string>(
  params: AdminListParams<F>,
  defaultFilter: F,
): ResolvedListParams<F> {
  const pageSize = Math.min(Math.max(1, Math.floor(params.pageSize ?? ADMIN_PAGE_SIZE)), ADMIN_MAX_PAGE_SIZE);
  return {
    search: (params.search ?? "").trim(),
    filter: params.filter ?? defaultFilter,
    page: Math.max(1, Math.floor(params.page ?? 1)),
    pageSize,
  };
}

/** The search/limit/offset arguments every admin_list_* function takes. */
export function pagingArgs(params: ResolvedListParams<string>) {
  return {
    p_search: params.search || null,
    p_limit: params.pageSize,
    p_offset: (params.page - 1) * params.pageSize,
  };
}

export function totalPagesOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the `{ total, rows }` envelope an admin_list_* function returns and maps each row.
 * Throws a readable error if the database sent something else, so the page can say so.
 */
export function parseAdminListResult<T>(
  data: Json | null,
  rpcName: string,
  mapRow: (row: Record<string, unknown>) => T,
): AdminListPage<T> {
  if (!isRecord(data) || !Array.isArray(data.rows)) {
    console.error(`[${rpcName}] unexpected response shape`, data);
    throw new Error("The server sent an unexpected response. Please try again.");
  }
  const rows = (data.rows as unknown[]).filter(isRecord).map(mapRow);
  const total = Number(data.total);
  return { total: Number.isFinite(total) ? total : rows.length, rows };
}

/** Turns a Supabase/PostgREST error into an Error with a message people can read. */
export function adminRpcError(rpcName: string, error: { message: string; code?: string }, context?: unknown): Error {
  console.error(`[${rpcName}] failed`, { error, context });
  if (error.code === "42501" || /admin/i.test(error.message)) {
    return new Error("You need admin access to see this list.");
  }
  return new Error(error.message || "Couldn't load this list. Check your connection and try again.");
}

/** Reads every page of a list (200 rows at a time) for callers that need the whole set. */
export async function fetchAllAdminPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<AdminListPage<T>>,
): Promise<T[]> {
  const all: T[] = [];
  for (let pageIndex = 0; pageIndex < MAX_FETCH_ALL_PAGES; pageIndex++) {
    const { rows, total } = await fetchPage(ADMIN_MAX_PAGE_SIZE, pageIndex * ADMIN_MAX_PAGE_SIZE);
    all.push(...rows);
    if (rows.length < ADMIN_MAX_PAGE_SIZE || all.length >= total) return all;
  }
  console.warn("[fetchAllAdminPages] stopped after the page limit", { rows: all.length });
  return all;
}

// Row field readers: JSON from the database is untyped, so each field is coerced explicitly.
export const str = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
export const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
export const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
export const bool = (value: unknown): boolean => value === true;
export const recordOrNull = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null);
export const recordList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

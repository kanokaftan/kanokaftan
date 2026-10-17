import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { ADMIN_PAGE_SIZE, ADMIN_SEARCH_DEBOUNCE_MS, totalPagesOf, type ResolvedListParams } from "@/hooks/adminList";

/** URL keys the admin lists read and write: /admin/orders?q=amina&filter=combined */
export const LIST_SEARCH_PARAM = "q";
export const LIST_FILTER_PARAM = "filter";

interface AdminListStateOptions<F extends string> {
  /** Every filter value the server accepts; anything else in the URL falls back to `defaultFilter`. */
  filters: readonly F[];
  defaultFilter: F;
  /** Older links used another key for the search (Orders used ?search=<order id>). */
  legacySearchParam?: string;
}

/**
 * Search box, filter chip and page for one admin list, kept in the URL (`?q=` and `?filter=`,
 * replaced rather than pushed) so links like /admin/orders?filter=disputed open the right view.
 * The search is debounced before it reaches the server; changing the search or filter goes back to page 1.
 */
export function useAdminListState<F extends string>({ filters, defaultFilter, legacySearchParam }: AdminListStateOptions<F>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get(LIST_SEARCH_PARAM) ?? (legacySearchParam ? searchParams.get(legacySearchParam) : null) ?? "";
  const urlFilter = searchParams.get(LIST_FILTER_PARAM);
  const filter: F = filters.find((value) => value === urlFilter) ?? defaultFilter;

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search.trim(), ADMIN_SEARCH_DEBOUNCE_MS);

  // The last search this hook wrote to the URL; a different value there came from a link or the back button.
  const writtenSearch = useRef(urlSearch.trim());
  useEffect(() => {
    if (urlSearch.trim() !== writtenSearch.current) {
      writtenSearch.current = urlSearch.trim();
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  const updateUrl = useCallback(
    (changes: { q?: string; filter?: F }) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (changes.q !== undefined) {
            if (changes.q) next.set(LIST_SEARCH_PARAM, changes.q);
            else next.delete(LIST_SEARCH_PARAM);
            if (legacySearchParam) next.delete(legacySearchParam);
          }
          if (changes.filter !== undefined) {
            if (changes.filter === defaultFilter) next.delete(LIST_FILTER_PARAM);
            else next.set(LIST_FILTER_PARAM, changes.filter);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaultFilter, legacySearchParam],
  );

  useEffect(() => {
    if (debouncedSearch === writtenSearch.current) return;
    writtenSearch.current = debouncedSearch;
    updateUrl({ q: debouncedSearch });
  }, [debouncedSearch, updateUrl]);

  // The page belongs to one search + filter; when either changes the list starts again at page 1.
  const listKey = `${filter}\u0000${debouncedSearch}`;
  const [pageState, setPageState] = useState({ key: listKey, page: 1 });
  const page = pageState.key === listKey ? pageState.page : 1;
  const setPage = useCallback((next: number) => setPageState({ key: listKey, page: Math.max(1, next) }), [listKey]);

  const setFilter = useCallback((next: F) => updateUrl({ filter: next }), [updateUrl]);

  const params: ResolvedListParams<F> = useMemo(
    () => ({ search: debouncedSearch, filter, page, pageSize: ADMIN_PAGE_SIZE }),
    [debouncedSearch, filter, page],
  );

  return {
    search,
    setSearch,
    /** True while typing: the list on screen is still for the previous search. */
    isSearchPending: search.trim() !== debouncedSearch,
    filter,
    setFilter,
    page,
    setPage,
    pageSize: ADMIN_PAGE_SIZE,
    params,
  };
}

/** After a delete or status change the last page can empty out; step back to the last page that has rows. */
export function useKeepPageInRange(page: number, setPage: (page: number) => void, total: number | undefined, pageSize: number) {
  useEffect(() => {
    if (total === undefined) return;
    const lastPage = totalPagesOf(total, pageSize);
    if (page > lastPage) setPage(lastPage);
  }, [page, setPage, total, pageSize]);
}

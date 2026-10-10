import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import {
  buildURLSearchParams,
  clearScopedParams,
  deserializeFilters,
  serializeFilters,
  type FilterSchema,
} from "../../../urlParams";
import { expensesSearchFilterSchema } from "./filterConfig";
import { revenuesSearchFilterSchema } from "../Revenues/filterConfig";
import type { SearchFilters as ExpenseSearchFilters } from "./types";
import type { SearchFilters as RevenueSearchFilters } from "../Revenues/types";

export default function useFullHistorySearch() {
  const [params, setParams] = useSearchParams();
  const latest = useRef(params);
  latest.current = params;
  const update = useCallback(
    <T extends Record<string, unknown>>(
      scope: string,
      schema: FilterSchema,
      value: SetStateAction<T>,
    ) => {
      const previous = deserializeFilters<T>(
        latest.current,
        schema,
        {} as T,
        scope,
      );
      const filters = typeof value === "function" ? value(previous) : value;
      const next = buildURLSearchParams(
        serializeFilters(filters, schema, scope),
        clearScopedParams(latest.current, scope),
      );
      latest.current = next;
      setParams(next, { replace: true });
    },
    [setParams],
  );
  const setExpenses = useCallback<
    Dispatch<SetStateAction<ExpenseSearchFilters>>
  >(
    (value) => update("expense_search", expensesSearchFilterSchema, value),
    [update],
  );
  const setRevenues = useCallback<
    Dispatch<SetStateAction<RevenueSearchFilters>>
  >(
    (value) => update("revenue_search", revenuesSearchFilterSchema, value),
    [update],
  );
  const openSearch = useCallback(() => {
    const next = clearScopedParams(
      clearScopedParams(latest.current, "expense_search"),
      "revenue_search",
    );
    next.set("view", "search");
    latest.current = next;
    setParams(next);
  }, [setParams]);
  const backToOverview = useCallback(() => {
    const next = new URLSearchParams(latest.current);
    next.delete("view");
    latest.current = next;
    setParams(next);
  }, [setParams]);
  return {
    isSearchMode: params.get("view") === "search",
    expenses: {
      filters: deserializeFilters<ExpenseSearchFilters>(
        params,
        expensesSearchFilterSchema,
        {},
        "expense_search",
      ),
      setFilters: setExpenses,
    },
    revenues: {
      filters: deserializeFilters<RevenueSearchFilters>(
        params,
        revenuesSearchFilterSchema,
        {},
        "revenue_search",
      ),
      setFilters: setRevenues,
    },
    openSearch,
    backToOverview,
  };
}

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import useFullHistorySearch from "./useFullHistorySearch";
import {
  getFullHistoryOrdering,
  getSearchDateControls,
} from "./fullHistorySearch";

afterEach(cleanup);
const setup = (url: string) =>
  renderHook(
    () => ({
      ...useFullHistorySearch(),
      location: useLocation(),
      navigate: useNavigate(),
    }),
    {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      ),
    },
  );

it("toolbar entry clears both search scopes while preserving overview and the selected tab", () => {
  const { result } = setup(
    "/?category=Casa&startDate=01/10/2026&revenues=true&revenues_bank_account_description=Nubank&expense_search_description=old&expense_search_startDate=01/01/2020&revenue_search_description=old&revenue_search_tag=old",
  );
  act(() => result.current.openSearch());
  const params = new URLSearchParams(result.current.location.search);
  expect(params.get("view")).toBe("search");
  expect(params.get("category")).toBe("Casa");
  expect(params.get("startDate")).toBe("01/10/2026");
  expect(params.get("revenues")).toBe("true");
  expect(params.get("revenues_bank_account_description")).toBe("Nubank");
  expect(
    [...params.keys()].some((key) => /^(expense|revenue)_search_/.test(key)),
  ).toBe(false);
  expect(result.current.expenses.filters).toEqual({});
  expect(result.current.revenues.filters).toEqual({});
});

it("independent scopes survive simultaneous updates, tab navigation and direct URL restoration", () => {
  const { result, unmount } = setup("/?view=search&category=Casa");
  act(() => {
    result.current.expenses.setFilters({
      description: "super",
      tag: ["one", "two"],
    });
    result.current.revenues.setFilters({
      description: "sal",
      bank_account_description: "Nubank",
    });
  });
  expect(result.current.expenses.filters).toEqual({
    description: "super",
    tag: ["one", "two"],
  });
  expect(result.current.revenues.filters).toEqual({
    description: "sal",
    bank_account_description: "Nubank",
  });
  const saved = result.current.location.search;
  act(() => result.current.navigate(`${saved}&revenues=true`));
  expect(result.current.expenses.filters.description).toBe("super");
  act(() => result.current.navigate(-1));
  expect(result.current.revenues.filters.description).toBe("sal");
  unmount();
  const restored = setup(`/${saved}`).result;
  expect(restored.current.expenses.filters.tag).toEqual(["one", "two"]);
  expect(restored.current.revenues.filters.description).toBe("sal");
  act(() => restored.current.backToOverview());
  expect(restored.current.isSearchMode).toBe(false);
  expect(
    new URLSearchParams(restored.current.location.search).get("category"),
  ).toBe("Casa");
});

it("either optional date can be cleared without replacing the other or applying a month", () => {
  const { result } = renderHook(() => {
    const [filters, setFilters] = useState({
      startDate: "01/01/2020",
      endDate: "31/12/2030",
      description: "super",
    });
    return { filters, controls: getSearchDateControls(filters, setFilters) };
  });
  act(() => result.current.controls.onStartDateChange(null));
  expect(result.current.filters.startDate).toBeUndefined();
  expect(result.current.filters.endDate).toBe("31/12/2030");
  act(() => result.current.controls.onEndDateChange(null));
  expect(result.current.filters.endDate).toBeUndefined();
  expect(result.current.filters.description).toBe("super");
});

it("sorts with the approved stable ID tie-breaker", () => {
  expect(getFullHistoryOrdering([])).toBe("-created_at,-id");
  expect(getFullHistoryOrdering([{ id: "value", desc: false }])).toBe(
    "value,-id",
  );
  expect(getFullHistoryOrdering([{ id: "created_at", desc: true }])).toBe(
    "-created_at,-id",
  );
});

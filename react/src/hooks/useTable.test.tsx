import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import useTable from "./useTable";

vi.mock("material-react-table", () => ({
  useMaterialReactTable: (options: unknown) => ({ options }),
}));
afterEach(cleanup);
function wrapper({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

it("uses controlled search without forwarding custom options to MRT", async () => {
  const { result } = renderHook(
    () => {
      const [search, setSearch] = useState("rent");
      return useTable({
        columns: [],
        queryKey: ["controlled"],
        queryFn: async () => ({ results: [], count: 0 }),
        externalSearch: { value: search, setValue: setSearch },
      });
    },
    { wrapper },
  );
  expect(result.current.search).toBe("rent");
  act(() => result.current.setSearch("food"));
  expect(result.current.search).toBe("food");
  expect(result.current.table.options).not.toHaveProperty("externalSearch");
});

it("resets an opted-in filter change before issuing the next page request", async () => {
  const requests: unknown[][] = [];
  const { result, rerender } = renderHook(
    ({ key }) =>
      useTable({
        columns: [],
        queryKey: ["reset"],
        paginationResetKey: key,
        externalFilters: { filters: { category: [key] }, setFilters: () => {} },
        queryFn: async ({ queryKey }) => {
          requests.push([...queryKey]);
          return { results: [], count: 301 };
        },
      }),
    { wrapper, initialProps: { key: "a" } },
  );
  await waitFor(() => expect(requests).toHaveLength(1));
  act(() => result.current.setPagination({ pageIndex: 2, pageSize: 100 }));
  await waitFor(() => expect(requests).toHaveLength(2));
  rerender({ key: "b" });
  await waitFor(() => expect(result.current.pagination.pageIndex).toBe(0));
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2][1]).toBe(0);
  expect(requests[2].at(-1)).toEqual({ category: ["b"] });
});

it("preserves non-opting caller pagination and default search behavior", async () => {
  const { result, rerender } = renderHook(
    ({ filters }) =>
      useTable({
        columns: [],
        queryKey: ["legacy"],
        queryFn: async () => ({ results: [], count: 301 }),
        externalFilters: { filters, setFilters: () => {} },
      }),
    { wrapper, initialProps: { filters: { category: "Casa" } } },
  );
  expect(result.current.search).toBe("");
  act(() => result.current.setPagination({ pageIndex: 2, pageSize: 100 }));
  rerender({ filters: { category: "Food" } });
  expect(result.current.pagination.pageIndex).toBe(2);
});

it("exposes query failure for search pagination while retaining the existing alert", async () => {
  const error = new Error("Invalid page.");
  const { result } = renderHook(
    () =>
      useTable({
        columns: [],
        queryKey: ["failure"],
        queryFn: async () => {
          throw error;
        },
      }),
    { wrapper },
  );
  await waitFor(() =>
    expect(result.current.table.options.state?.showAlertBanner).toBe(true),
  );
  expect(result.current.queryError).toBe(error);
});

it("refreshes an invalidated search when revisited under the app's cache defaults", async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnMount: false },
    },
  });
  const provider = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  let rows = [{ id: 1, description: "rent" }];
  const read = () =>
    useTable({
      columns: [],
      queryKey: ["search-revisit"],
      paginationResetKey: "rent",
      queryFn: async () => ({ results: rows, count: rows.length }),
    });
  const first = renderHook(read, { wrapper: provider });
  await waitFor(() =>
    expect(first.result.current.table.options.data).toHaveLength(1),
  );
  first.unmount();
  rows = [];
  await client.invalidateQueries({ queryKey: ["search-revisit"] });
  const second = renderHook(read, { wrapper: provider });
  await waitFor(() =>
    expect(second.result.current.table.options.data).toEqual([]),
  );
});

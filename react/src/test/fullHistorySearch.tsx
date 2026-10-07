import { useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { AxiosError } from "axios";
import { vi } from "vitest";
import { apiProvider } from "../api/methods";
import { ExpensesContext } from "../pages/private/Expenses/context";
import type { Revenue } from "../pages/private/Revenues/models";
import type { Expense } from "../pages/private/Expenses/api/models";

export const expenseRow = (id = 1, extra: Partial<Expense> = {}): Expense => ({
  id,
  description: "rent",
  full_description: "rent",
  value: 100,
  category: "Casa",
  source: "Cartão de crédito",
  created_at: "2020-01-15",
  is_fixed: false,
  tags: [],
  bank_account_description: "Nubank",
  installments_id: null,
  installment_number: null,
  installments_qty: null,
  ...extra,
});

export function fakeSearchApi<T extends Expense | Revenue>(
  initial: T[],
  resource = "expenses",
) {
  let rows = [...initial];
  const requests: { resource: string; params: Record<string, any> }[] = [];
  const bank = {
    description: "Nubank",
    amount: 10000,
    is_active: true,
    is_default: true,
    updated_at: "2026-10-07",
    credit_card_bill_day: null,
  };
  const get = vi
    .spyOn(apiProvider, "get")
    .mockImplementation(async (url: string, config?: any) => {
      if (
        url === resource ||
        (resource === "all" && ["expenses", "revenues"].includes(url))
      ) {
        const params = config?.params ?? {};
        requests.push({ resource: url, params });
        let matching = rows.filter(
          (row) =>
            !params.description ||
            row.description
              .toLowerCase()
              .startsWith(params.description.toLowerCase()),
        );
        if (params.is_fixed !== undefined)
          matching = matching.filter((row) => row.is_fixed === params.is_fixed);
        if (params.with_installments !== undefined)
          matching = matching.filter(
            (row) =>
              !!("installments_id" in row && row.installments_id) ===
              params.with_installments,
          );
        const page = params.page ?? 1,
          size = params.page_size ?? 100;
        if (page > Math.max(1, Math.ceil(matching.length / size))) {
          const error = new AxiosError("Invalid page.");
          error.response = {
            data: { detail: "Invalid page." },
            status: 404,
            statusText: "Not Found",
            headers: {},
            config: {} as any,
          };
          throw error;
        }
        return {
          data: {
            count: matching.length,
            results: matching.slice((page - 1) * size, page * size),
          },
        } as any;
      }
      if (url === "bank_accounts")
        return { data: { count: 1, results: [bank] } } as any;
      if (url.endsWith("/tags")) return { data: [] } as any;
      if (url.endsWith("/most_common"))
        return {
          data: {
            name: url.includes("sources") ? "Cartão de crédito" : "Casa",
            hex_color: "#fff",
          },
        } as any;
      return { data: { results: [], count: 0 } } as any;
    });
  const put = vi
    .spyOn(apiProvider, "put")
    .mockImplementation(async (url: string, data: any) => {
      const id = Number(url.split("/").at(-1));
      rows = rows.map((row) =>
        row.id === id
          ? {
              ...row,
              ...data,
              created_at:
                data.created_at?.split("/").reverse().join("-") ??
                row.created_at,
              full_description: data.description,
            }
          : row,
      );
      return { data: rows.find((row) => row.id === id) } as any;
    });
  const remove = vi
    .spyOn(apiProvider, "Delete")
    .mockImplementation(async (url: string, config?: any) => {
      const row = rows.find((row) => row.id === Number(url.split("/").at(-1)));
      rows = rows.filter((item) =>
        row && "installments_id" in row && row.installments_id
          ? !("installments_id" in item) ||
            item.installments_id !== row.installments_id
          : row?.is_fixed &&
              config?.params?.perform_actions_on_future_fixed_entities
            ? !item.is_fixed
            : item.id !== row?.id,
      );
      return { data: undefined } as any;
    });
  return {
    requests,
    get,
    put,
    remove,
    getRows: () => rows,
    setRows: (next: T[]) => {
      rows = next;
    },
  };
}

export function searchClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function SearchTestProvider({
  children,
  client,
  search = true,
}: {
  children: ReactNode;
  client: QueryClient;
  search?: boolean;
}) {
  const [startDate, setStartDate] = useState(new Date(2026, 9, 1));
  const [endDate, setEndDate] = useState(new Date(2026, 9, 31));
  const category = { id: 1, name: "Casa", hex_color: "#fff" };
  const source = { id: 2, name: "Cartão de crédito", hex_color: "#fff" };
  return (
    <MemoryRouter initialEntries={[search ? "/?view=search" : "/"]}>
      <QueryClientProvider client={client}>
        <SnackbarProvider>
          <ExpensesContext.Provider
            value={
              {
                startDate,
                setStartDate,
                endDate,
                setEndDate,
                month: 9,
                setMonth: () => {},
                year: 2026,
                setYear: () => {},
                categories: {
                  results: [category],
                  hexColorMapping: new Map([["Casa", "#fff"]]),
                },
                sources: {
                  results: [source],
                  hexColorMapping: new Map([[source.name, "#fff"]]),
                },
                revenuesCategories: {
                  results: [category],
                  hexColorMapping: new Map([["Casa", "#fff"]]),
                },
                mostCommonCategory: category,
                mostCommonSource: source,
                mostCommonRevenueCategory: category,
                isRelatedEntitiesLoading: false,
                isFullHistorySearch: search,
              } as any
            }
          >
            {children}
          </ExpensesContext.Provider>
        </SnackbarProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

export const revenueRow = (id = 1, extra: Partial<Revenue> = {}): Revenue => ({
  id,
  description: "rent",
  full_description: "rent",
  value: 100,
  category: "Casa",
  created_at: "2020-01-15",
  is_fixed: false,
  bank_account_description: "Nubank",
  ...extra,
});

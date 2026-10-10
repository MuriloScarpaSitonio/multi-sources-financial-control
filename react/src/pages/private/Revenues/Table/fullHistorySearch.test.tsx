import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import Table from "./index";
import {
  revenueRow,
  fakeSearchApi,
  SearchTestProvider,
  searchClient,
} from "../../../../test/fullHistorySearch";
import { REVENUES_QUERY_KEY } from "../consts";
import type { SearchFilters } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(rows = [revenueRow()], filters: SearchFilters = {}) {
  const api = fakeSearchApi(rows, "revenues");
  const client = searchClient();
  function SearchTable() {
    const [state, setFilters] = useState(filters);
    return (
      <Table
        mode="search"
        externalFilters={{ filters: state, setFilters }}
        onBackToOverview={() => {}}
      />
    );
  }
  const view = render(
    <SearchTestProvider client={client}>
      <SearchTable />
    </SearchTestProvider>,
  );
  return { api, client, ...view };
}

it("uses one unpartitioned request without overview dates and paginates the full count", async () => {
  const rows = Array.from({ length: 202 }, (_, index) =>
    revenueRow(index + 1, { full_description: `rent ${index + 1}` }),
  );
  const { api } = setup(rows);
  await screen.findByText("rent 1");
  expect(api.requests).toHaveLength(1);
  expect(api.requests[0].params).toMatchObject({
    page: 1,
    page_size: 100,
    ordering: "-created_at,-id",
  });
  expect(api.requests[0].params.start_date).toBeUndefined();
  expect(api.requests[0].params.end_date).toBeUndefined();
  expect(api.requests[0].params.is_fixed).toBeUndefined();
  expect(api.requests[0].params.category).toBeUndefined();
  expect(api.requests[0].params.tag).toBeUndefined();
  expect(screen.queryByText("Outras")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
  await screen.findByText("rent 101");
  expect(api.requests.at(-1)?.params.page).toBe(2);
  expect(screen.getByRole("button", { name: "Go to page 3" })).toBeEnabled();
});

it("editing through the existing drawer refetches matching rows and preserves overview cache", async () => {
  const { api, client } = setup([revenueRow()], { description: "rent" });
  const overview = { count: 1, results: [revenueRow()] };
  client.setQueryData([REVENUES_QUERY_KEY, "overview-test"], overview);
  await screen.findByText("rent");
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  const input = await screen.findByLabelText(/^Descrição/);
  fireEvent.change(input, { target: { value: "food" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" }).at(-1)!);
  await waitFor(() => expect(api.getRows()[0].description).toBe("food"));
  await screen.findByText("Nenhuma receita encontrada");
  expect(client.getQueryData([REVENUES_QUERY_KEY, "overview-test"])).toEqual(
    overview,
  );
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("installments_id");
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("installment_number");
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("installments_qty");
}, 15000);

it("an invalid final page after deletion displays a preceding page with unchanged filters", async () => {
  const rows = Array.from({ length: 101 }, (_, index) =>
    revenueRow(index + 1, { full_description: `rent ${index + 1}` }),
  );
  const { api } = setup(rows, {
    description: "rent",
    startDate: "01/01/2020",
    bank_account_description: "Nubank",
  });
  await screen.findByText("rent 1");
  fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
  await screen.findByText("rent 101");
  fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Deletar" }),
  );
  await screen.findByText("rent 1");
  expect(api.requests.at(-1)?.params).toMatchObject({
    page: 1,
    page_size: 100,
    description: "rent",
    start_date: "01/01/2020",
    bank_account_description: "Nubank",
  });
  expect(api.requests.some((request) => request.params.page_size === 1)).toBe(
    false,
  );
}, 15000);

it("failed deletion leaves the row and existing confirmation available", async () => {
  const { api } = setup();
  api.remove.mockRejectedValue(new Error("Delete failed"));
  await screen.findByText("rent");
  fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Deletar" }),
  );
  await waitFor(() => expect(api.remove).toHaveBeenCalled());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("rent")).toBeInTheDocument();
  expect(api.getRows()).toHaveLength(1);
});

it("sends all scoped filters and lets either date be cleared independently", async () => {
  const { api } = setup([revenueRow()], {
    description: "rent",
    bank_account_description: "Nubank",
    startDate: "01/01/2020",
    endDate: "31/01/2020",
  });
  await screen.findByText("rent");
  expect(api.requests[0].params).toMatchObject({
    bank_account_description: "Nubank",
    start_date: "01/01/2020",
    end_date: "31/01/2020",
    description: "rent",
  });
  fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
  const start = screen.getByLabelText("Início");
  const end = screen.getByLabelText("Fim");
  expect(screen.queryByLabelText("Categoria")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tags")).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([url]) => url.endsWith("/tags"))).toBe(false);
  expect(start).not.toBeRequired();
  expect(end).not.toBeRequired();
  fireEvent.change(start, { target: { value: "" } });
  await waitFor(() =>
    expect(api.requests.at(-1)?.params.start_date).toBeUndefined(),
  );
  expect(api.requests.at(-1)?.params.end_date).toBe("31/01/2020");
  fireEvent.change(end, { target: { value: "" } });
  await waitFor(() =>
    expect(api.requests.at(-1)?.params.end_date).toBeUndefined(),
  );
  expect(api.requests.at(-1)?.params.description).toBe("rent");
});

it("fixed rows keep the existing future deletion toggle and balance/report invalidation", async () => {
  const { api, client } = setup([
    revenueRow(1, { is_fixed: true }),
    revenueRow(2, { is_fixed: true }),
  ]);
  client.setQueryData(["bank-accounts-summary"], { total: 10000 });

  await screen.findAllByText("rent");
  fireEvent.click(screen.getAllByRole("button", { name: "Deletar" })[0]);
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).queryByText(/TODAS AS OUTRAS PARCELAS/),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).getByText("Aplicar em receitas futuras?"),
  ).toBeVisible();
  fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Deletar" }));
  await screen.findByText("Nenhuma receita encontrada");
  expect(
    api.remove.mock.calls[0][1].params.perform_actions_on_future_fixed_entities,
  ).toBe(true);
  expect(client.getQueryState(["bank-accounts-summary"])?.isInvalidated).toBe(
    true,
  );
});

it("failed edits retain server feedback and matching search rows", async () => {
  const { api } = setup();
  api.put.mockRejectedValue({
    response: { data: { description: ["Cannot edit revenue"] } },
  });
  await screen.findByText("rent");
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.change(await screen.findByLabelText(/^Descrição/), {
    target: { value: "food" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Editar" }).at(-1)!);
  await screen.findByText("Cannot edit revenue");
  expect(api.getRows()[0].description).toBe("rent");
  expect(api.requests).toHaveLength(1);
});

it("an old invalid page cannot move a newer search", async () => {
  const { api } = setup(
    Array.from({ length: 101 }, (_, index) =>
      revenueRow(index + 1, { full_description: `rent ${index + 1}` }),
    ),
  );
  await screen.findByText("rent 1");
  const originalGet = api.get.getMockImplementation()!;
  let rejectOld: (error: unknown) => void = () => {};
  api.get.mockImplementation((url: string, config?: any) =>
    config?.params?.page === 2
      ? new Promise((_resolve, reject) => {
          rejectOld = reject;
        })
      : originalGet(url, config),
  );
  fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
  await waitFor(() =>
    expect(
      api.get.mock.calls.some(([, config]) => config?.params?.page === 2),
    ).toBe(true),
  );
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "food" },
  });
  await screen.findByText("Nenhuma receita encontrada", {}, { timeout: 2000 });
  const requestCount = api.requests.length;
  rejectOld({
    response: { status: 404, data: { detail: "Invalid page." } },
    isAxiosError: true,
  });
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "food",
    ),
  );
  expect(api.requests.at(-1)?.params).toMatchObject({
    description: "food",
    page: 1,
    page_size: 100,
  });
  expect(api.requests).toHaveLength(requestCount);
});

it("other list failures keep feedback without requesting a different page", async () => {
  const api = fakeSearchApi([revenueRow()], "revenues");
  api.get.mockRejectedValue({ response: { status: 500 }, isAxiosError: true });
  render(
    <SearchTestProvider client={searchClient()}>
      <Table
        mode="search"
        externalFilters={{ filters: {}, setFilters: () => {} }}
        onBackToOverview={() => {}}
      />
    </SearchTestProvider>,
  );
  await screen.findByRole("alert");
  expect(api.get.mock.calls.filter(([url]) => url === "revenues")).toHaveLength(
    1,
  );
});

it.each(["delete", "edit"])(
  "a pending %s cannot publish a pre-mutation first search response",
  async (action) => {
    const row = revenueRow();
    const api = fakeSearchApi([row], "revenues");
    const client = searchClient();
    const originalMutation =
      action === "delete"
        ? api.remove.getMockImplementation()!
        : api.put.getMockImplementation()!;
    let finishMutation: () => void = () => {};
    const pendingMutation = (url: string, data?: any) =>
      new Promise<any>((resolve) => {
        finishMutation = () => resolve(originalMutation(url, data));
      });
    if (action === "delete") api.remove.mockImplementation(pendingMutation);
    else api.put.mockImplementation(pendingMutation);
    const mount = (filters: SearchFilters) =>
      render(
        <SearchTestProvider client={client}>
          <Table
            mode="search"
            externalFilters={{ filters, setFilters: () => {} }}
            onBackToOverview={() => {}}
          />
        </SearchTestProvider>,
      );
    const first = mount({});
    await screen.findByText("rent");
    if (action === "delete") {
      fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Deletar",
        }),
      );
      await waitFor(() => expect(api.remove).toHaveBeenCalled());
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      fireEvent.change(await screen.findByLabelText(/^Descrição/), {
        target: { value: "food" },
      });
      fireEvent.click(
        screen.getAllByRole("button", { name: "Editar" }).at(-1)!,
      );
      await waitFor(() => expect(api.put).toHaveBeenCalled());
    }
    first.unmount();
    const originalGet = api.get.getMockImplementation()!;
    let finishRead: () => void = () => {};
    let reads = 0;
    api.get.mockImplementation((url: string, config?: any) => {
      if (
        url === "revenues" &&
        config?.params?.description === "rent" &&
        ++reads === 1
      ) {
        return new Promise((resolve) => {
          finishRead = () =>
            resolve({ data: { count: 1, results: [row] } } as any);
        });
      }
      return originalGet(url, config);
    });
    mount({ description: "rent" });
    await waitFor(() => expect(reads).toBe(1));
    finishMutation();
    await waitFor(() =>
      expect(
        api.getRows().filter((item) => item.description === "rent"),
      ).toHaveLength(0),
    );
    await waitFor(() => {
      const query = client
        .getQueryCache()
        .getAll()
        .find((q) => q.queryKey[0] === "revenues" && q.queryKey[5] === "rent");
      expect(query?.state.isInvalidated || reads > 1).toBe(true);
    });
    await act(async () => {
      finishRead();
    });
    await screen.findByText("Nenhuma receita encontrada");
    expect(reads).toBe(2);
  },
  10000,
);

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import Expenses from "./index";
import {
  expenseRow,
  fakeSearchApi,
  searchClient,
} from "../../../test/fullHistorySearch";

vi.mock("./Indicators", () => ({
  default: () => <div data-testid="indicators" />,
}));
vi.mock("./Reports", () => ({
  default: () => <div data-testid="expense-reports" />,
}));
vi.mock("../Revenues/Reports", () => ({
  default: () => <div data-testid="revenue-reports" />,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});
function Navigation() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>History back</button>
      <button onClick={() => navigate(1)}>History forward</button>
      <button
        onClick={() =>
          navigate(
            "/?view=search&expense_search_description=food&expense_search_endDate=31%2F12%2F2030",
          )
        }
      >
        Other search
      </button>
    </>
  );
}
function setup(url: string, rows = [expenseRow()]) {
  window.history.replaceState(null, "", url);
  const api = fakeSearchApi(rows, "all"),
    client = searchClient();
  const mount = () =>
    render(
      <BrowserRouter>
        <QueryClientProvider client={client}>
          <SnackbarProvider>
            <Navigation />
            <Expenses />
          </SnackbarProvider>
        </QueryClientProvider>
      </BrowserRouter>,
    );
  return { api, client, mount, ...mount() };
}

it.each([false, true])(
  "entry from overview preserves its resource and overview settings (revenues=%s)",
  async (revenues) => {
    const { api } = setup(
      `/?revenues=${revenues}&startDate=01%2F01%2F2020&endDate=31%2F01%2F2020&category=Casa&tag=travel&revenues_bank_account_description=Nubank&expense_search_description=old&revenue_search_description=old`,
    );
    await screen.findByText("rent");
    const resource = revenues ? "revenues" : "expenses";
    fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
      target: { value: "rent" },
    });
    await waitFor(
      () =>
        expect(
          api.requests.filter((r) => r.resource === resource).at(-1)?.params
            .description,
        ).toBe("rent"),
      { timeout: 2000 },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: revenues
          ? "Pesquisar todas as receitas"
          : "Pesquisar todas as despesas",
      }),
    );
    await screen.findByRole("button", { name: "Voltar à visão geral" });
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "",
    );
    const params = new URLSearchParams(window.location.search);
    expect(params.get("view")).toBe("search");
    expect(params.get("revenues")).toBe(String(revenues));
    expect(params.get("category")).toBe("Casa");
    expect(params.get("tag")).toBe("travel");
    expect(params.get("startDate")).toBe("01/01/2020");
    expect(params.get("expense_search_description")).toBeNull();
    expect(params.get("revenue_search_description")).toBeNull();
    expect(screen.queryByTestId("indicators")).not.toBeInTheDocument();
    expect(screen.queryByTestId("expense-reports")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revenue-reports")).not.toBeInTheDocument();
    expect(screen.queryByText("Janeiro")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        api.requests.filter((r) => r.resource === resource).at(-1)?.params
          .start_date,
      ).toBeUndefined(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    fireEvent.change(screen.getByLabelText("Fim"), {
      target: { value: "31/12/2030" },
    });
    await waitFor(() =>
      expect(
        api.requests.filter((r) => r.resource === resource).at(-1)?.params
          .end_date,
      ).toBe("31/12/2030"),
    );
    fireEvent.keyDown(screen.getByLabelText("Fim"), { key: "Escape" });
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar à visão geral" }),
    );
    await screen.findByTestId("indicators");
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "rent",
    );
    expect(new URLSearchParams(window.location.search).get("endDate")).toBe(
      "31/01/2020",
    );
    await waitFor(() =>
      expect(
        api.requests
          .filter(
            (r) => r.resource === resource && r.params.is_fixed !== undefined,
          )
          .at(-1)?.params,
      ).toMatchObject({
        description: "rent",
        start_date: "01/01/2020",
        end_date: "31/01/2020",
      }),
    );
  },
  15000,
);

it("keeps independent descriptions when switching resource tabs", async () => {
  setup("/?view=search");
  await screen.findByRole("button", { name: "Voltar à visão geral" });
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "super" },
  });
  await waitFor(
    () =>
      expect(
        new URLSearchParams(window.location.search).get(
          "expense_search_description",
        ),
      ).toBe("super"),
    { timeout: 2000 },
  );
  fireEvent.click(screen.getByRole("tab", { name: "Receitas" }));
  expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
    "",
  );
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "sal" },
  });
  await waitFor(
    () =>
      expect(
        new URLSearchParams(window.location.search).get(
          "revenue_search_description",
        ),
      ).toBe("sal"),
    { timeout: 2000 },
  );
  fireEvent.click(screen.getByRole("tab", { name: "Despesas" }));
  expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
    "super",
  );
});

it("restores a direct search across refresh and browser history", async () => {
  const view = setup(
    "/?view=search&revenues=false&expense_search_description=rent&expense_search_startDate=01%2F01%2F2020",
  );
  await screen.findByText("rent");
  expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
    "rent",
  );
  view.unmount();
  view.mount();
  await screen.findByText("rent");
  fireEvent.click(screen.getByRole("button", { name: "Other search" }));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "food",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "History back" }));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "rent",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "History forward" }));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
      "food",
    ),
  );
});

it("a filter change on page two requests only page one for the new search", async () => {
  const { api } = setup(
    "/?view=search",
    Array.from({ length: 101 }, (_, i) =>
      expenseRow(i + 1, { full_description: `rent ${i + 1}` }),
    ),
  );
  await screen.findByText("rent 1");
  fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
  await screen.findByText("rent 101");
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "food" },
  });
  await waitFor(
    () =>
      expect(api.requests.some((r) => r.params.description === "food")).toBe(
        true,
      ),
    { timeout: 2000 },
  );
  expect(
    api.requests
      .filter((r) => r.params.description === "food")
      .map((r) => r.params.page),
  ).toEqual([1]);
});

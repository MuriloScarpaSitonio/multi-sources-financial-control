import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import {
  FullHistoryFilterIndicators,
  FullHistorySearchBar,
} from "./FullHistorySearchControls";
import useFullHistorySearch from "./useFullHistorySearch";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness() {
  const [search, setSearch] = useState("rent");
  const [visible, setVisible] = useState(true);
  return (
    <>
      {visible && (
        <FullHistorySearchBar search={search} setSearch={setSearch} />
      )}
      <output data-testid="applied">{search}</output>
      <button onClick={() => setSearch("salary")}>External change</button>
      <button onClick={() => setVisible(false)}>Close search</button>
    </>
  );
}

it("keeps the 600ms delay and cancels a pending update when external search changes", () => {
  vi.useFakeTimers();
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  const input = screen.getByPlaceholderText("Pesquisar por descrição");
  fireEvent.change(input, { target: { value: "food" } });
  act(() => vi.advanceTimersByTime(599));
  expect(screen.getByTestId("applied")).toHaveTextContent("rent");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("applied")).toHaveTextContent("food");
  fireEvent.change(input, { target: { value: "old pending" } });
  fireEvent.click(screen.getByText("External change"));
  act(() => vi.advanceTimersByTime(600));
  expect(input).toHaveValue("salary");
  expect(screen.getByTestId("applied")).toHaveTextContent("salary");
});

it("does not apply pending text after the search control unmounts", () => {
  vi.useFakeTimers();
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "food" },
  });
  fireEvent.click(screen.getByText("Close search"));
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByTestId("applied")).toHaveTextContent("rent");
});

it("browser back cancels pending text even when both URLs have the same description", () => {
  vi.useFakeTimers();
  function Search() {
    const state = useFullHistorySearch();
    const navigate = useNavigate();
    return (
      <>
        <FullHistorySearchBar
          search={state.expenses.filters.description ?? ""}
          setSearch={(value) =>
            state.expenses.setFilters((prev) => ({
              ...prev,
              description:
                typeof value === "function"
                  ? value(prev.description ?? "")
                  : value,
            }))
          }
        />
        <button onClick={() => navigate(-1)}>Back</button>
        <output data-testid="tag">
          {state.expenses.filters.tag?.join(",")}
        </output>
      </>
    );
  }
  render(
    <MemoryRouter
      initialEntries={[
        "/?view=search&expense_search_description=rent&expense_search_tag=red",
        "/?view=search&expense_search_description=rent&expense_search_tag=blue",
      ]}
      initialIndex={1}
    >
      <Search />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByPlaceholderText("Pesquisar por descrição"), {
    target: { value: "food" },
  });
  fireEvent.click(screen.getByText("Back"));
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByPlaceholderText("Pesquisar por descrição")).toHaveValue(
    "rent",
  );
  expect(screen.getByTestId("tag")).toHaveTextContent("red");
});

it("clearing entity/date filters preserves the separately held description", () => {
  function Indicators() {
    const [filters, setFilters] = useState({
      description: "super",
      category: ["Casa"],
      startDate: "01/01/2020",
    });
    return (
      <>
        <FullHistoryFilterIndicators
          filters={filters}
          setFilters={setFilters}
          fieldConfigs={{
            category: { label: "Categoria" },
            startDate: { label: "Início" },
          }}
        />
        <output data-testid="filters">{JSON.stringify(filters)}</output>
      </>
    );
  }
  render(<Indicators />);
  fireEvent.click(screen.getByText("Limpar filtros"));
  expect(JSON.parse(screen.getByTestId("filters").textContent!)).toEqual({
    description: "super",
  });
});

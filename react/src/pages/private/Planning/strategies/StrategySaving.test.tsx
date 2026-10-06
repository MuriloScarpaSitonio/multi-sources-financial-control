import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import DividendsOnlyDetail from "./DividendsOnlyDetail";
import OneOverNDetail from "./OneOverNDetail";

const state = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../hooks", () => ({
  useSelectedMethod: () => ({ selectedMethod: "fire" }),
  usePlanningPreferences: () => ({
    data: {
      preferences: {
        selected_method: "fire",
        dividends_only: { yield_override: 6 },
        one_over_n: { target_depletion_age: 95 },
      },
      dateOfBirth: "1986-01-01",
    },
  }),
  useUpdatePlanningPreferences: () => ({
    mutate: state.mutate,
    isPending: false,
  }),
}));
vi.mock("../useStrategyCommonData", () => ({
  useStrategyCommonData: () => ({
    avgExpenses: 5000,
    derivedMonthlySavings: 1000,
    isLoading: false,
    hasRequiredData: true,
    isError: false,
    retry: vi.fn(),
  }),
}));
vi.mock("../fireAllocation", () => ({
  useFireAllocation: () => ({
    data: { buckets: [{ category: "CASH", series: "CASH", total: 1000000 }] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../Assets/Indicators/hooks", () => ({
  useAssetsIndicators: () => ({ data: { total: 1000000 }, isPending: false }),
}));
vi.mock("../../Expenses/hooks", () => ({
  useBankAccountsSummary: () => ({ data: { total: 0 }, isPending: false }),
}));
vi.mock("../../Incomes/Indicators/hooks", () => ({
  useIncomesAvg: () => ({ data: { avg: 4000 }, isPending: false }),
}));
vi.mock("../../Incomes/Reports/hooks", () => ({
  useIncomesHistoric: () => ({ data: { historic: [] }, isPending: false }),
}));
vi.mock("../../Revenues/hooks/useRevenuesIndicators", () => ({
  useHomeRevenuesIndicators: () => ({ data: { avg: 6000 }, isPending: false }),
}));

afterEach(() => {
  cleanup();
  state.mutate.mockReset();
  vi.unstubAllGlobals();
});

it.each([
  {
    strategy: "dividends_only",
    Component: DividendsOnlyDetail,
    changed: { yield_override: 6.5 },
  },
  {
    strategy: "one_over_n",
    Component: OneOverNDetail,
    changed: { target_depletion_age: 96 },
  },
])(
  "saves inactive $strategy separately from activation",
  async ({ strategy, Component, changed }) => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "Worker",
      class {
        postMessage() {}
        terminate() {}
      },
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <Component />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" }),
    ).toBeNull();
    if (strategy === "one_over_n") {
      await user.click(
        screen.getByRole("button", { name: "Aumentar Idade alvo" }),
      );
    } else {
      screen.getAllByRole("slider")[0].focus();
      await user.keyboard("{ArrowRight}");
    }
    await user.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate).toHaveBeenCalledWith({
      [strategy]: expect.objectContaining(changed),
    });
    await user.click(
      screen.getByRole("button", { name: "Selecionar como ativa" }),
    );
    expect(state.mutate).toHaveBeenLastCalledWith({
      selected_method: strategy,
    });
  },
);

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OneOverNDetail from "./OneOverNDetail";
const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  error: false,
  retry: vi.fn(),
}));
vi.mock("../hooks", () => ({
  useSelectedMethod: () => ({ selectedMethod: "fire" }),
  usePlanningPreferences: () => ({
    data: {
      preferences: {
        selected_method: "fire",
        one_over_n: { target_depletion_age: 90 },
      },
      dateOfBirth: "1986-01-01",
    },
    isError: false,
    isPending: false,
    refetch: state.retry,
  }),
  useUpdatePlanningPreferences: () => ({
    mutate: state.mutate,
    isPending: false,
  }),
}));
vi.mock("../useStrategyCommonData", () => ({
  useStrategyCommonData: () => ({
    avgExpenses: 2500,
    derivedMonthlySavings: -500,
    isLoading: false,
    isError: state.error,
    hasRequiredData: !state.error,
    retry: state.retry,
  }),
}));
vi.mock("../fireAllocation", () => ({
  useFireAllocation: () => ({
    data: { buckets: [{ category: "CASH", series: "CASH", total: 600000 }] },
    isError: false,
    isPending: false,
    refetch: state.retry,
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "Worker",
    class {
      postMessage() {}
      terminate() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.mutate.mockReset();
  state.error = false;
  state.retry.mockReset();
});
function mount() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <OneOverNDetail />
      </ThemeProvider>
    </MemoryRouter>,
  );
}
it("saves inactive settings separately from activation using the shared controls", async () => {
  mount();
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Idade alvo" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar alterações" }),
  );
  expect(state.mutate).toHaveBeenLastCalledWith({
    one_over_n: expect.objectContaining({
      target_depletion_age: 91,
      sampling_method: "independent_months",
      extra_accumulation_years: 0,
    }),
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Selecionar como ativa" }),
  );
  expect(state.mutate).toHaveBeenLastCalledWith({
    selected_method: "one_over_n",
  });
});
it("keeps the approved about explanation available when data fails", async () => {
  state.error = true;
  mount();
  expect(
    screen.getByRole("button", { name: "Tentar novamente" }),
  ).toBeEnabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Sobre a estratégia" }),
  );
  expect(
    screen.getByRole("link", { name: "Conheça o método original" }),
  ).toHaveAttribute(
    "href",
    "https://www.bogleheads.org/wiki/Withdrawal_methods#1/N_withdrawal_amounts",
  );
  expect(screen.queryByText("Plano historicamente robusto")).toBeNull();
});

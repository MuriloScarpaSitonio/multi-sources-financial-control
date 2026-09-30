import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { VPWPlanningPreferences } from "../api";
import VPWDetail from "./VPWDetail";
const queryState = vi.hoisted(() => ({
  allocationError: false,
  commonError: false,
  planningError: false,
  selectedMethod: "vpw",
  savedVPW: { target_age: 99 } as VPWPlanningPreferences,
  mutate: vi.fn(),
}));
vi.mock("../hooks", () => ({
  useSelectedMethod: () => ({ selectedMethod: queryState.selectedMethod }),
  usePlanningPreferences: () => ({
    isError: queryState.planningError,
    data: {
      dateOfBirth: "1986-01-01",
      preferences: {
        selected_method: queryState.selectedMethod,
        vpw: queryState.savedVPW,
      },
    },
  }),
  useUpdatePlanningPreferences: () => ({
    mutate: queryState.mutate,
    isPending: false,
  }),
}));
vi.mock("../fireAllocation", () => ({
  useFireAllocation: () => ({
    isError: queryState.allocationError,
    data: { buckets: [{ category: "US_EQUITY", series: null, total: 100000 }] },
    isPending: false,
  }),
}));
vi.mock("../useStrategyCommonData", () => ({
  useStrategyCommonData: () => ({
    isError: queryState.commonError,
    avgExpenses: 5000,
    derivedMonthlySavings: 1000,
    isLoading: false,
  }),
}));
vi.mock("../../Assets/Reports/AssetAggregationReports/hooks", () => ({
  useAssetsReports: () => ({ data: [], isPending: false }),
}));
vi.mock("../../Home/VPWIndicator", () => ({
  default: () => <div>Legacy VPW indicator</div>,
}));
afterEach(() => {
  Object.assign(queryState, {
    allocationError: false,
    commonError: false,
    planningError: false,
    selectedMethod: "vpw",
    savedVPW: { target_age: 99 },
  });
  queryState.mutate.mockReset();
  cleanup();
  vi.unstubAllGlobals();
});
it("connects the actual VPW route to the new studio and asset-specific worker", async () => {
  const post = vi.fn();
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = post;
      terminate() {}
    },
  );
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <VPWDetail />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByText("Seu cenário")).toBeVisible();
  expect(screen.getByTestId("vpw-simulation-studio")).toBeVisible();
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect(post.mock.calls[0][0].request).toMatchObject({
    kind: "vpw",
    input: { portfolio: [{ series: "SPY" }] },
  });
  expect(screen.queryByText(/Retorno real RV/)).toBeNull();
});

it.each(["allocationError", "commonError", "planningError"] as const)(
  "does not calculate fallback financial results when %s is true",
  async (field) => {
    queryState[field] = true;
    const post = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        postMessage = post;
        terminate() {}
      },
    );
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <VPWDetail />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/carregar os dados/i);
    expect(post).not.toHaveBeenCalled();
    queryState[field] = false;
  },
);

const renderDetail = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <VPWDetail />
      </MemoryRouter>
    </ThemeProvider>,
  );

it("saves only VPW fields and restores the saved scenario on reopening", async () => {
  vi.stubGlobal(
    "Worker",
    class {
      postMessage() {}
      terminate() {}
    },
  );
  const { unmount } = renderDetail();
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Idade alvo" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Premissas avançadas" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Anos extras de acumulação" }),
  );
  await userEvent.click(
    screen.getByLabelText("Preservar sequências históricas de 12 meses"),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar alterações" }),
  );
  expect(queryState.mutate).toHaveBeenCalledTimes(1);
  const patch = queryState.mutate.mock.calls[0][0];
  expect(Object.keys(patch)).toEqual(["vpw"]);
  expect(patch.vpw).toMatchObject({
    extra_accumulation_years: 1,
    monthly_expenses_override: 5500,
    target_age: 100,
    sampling_method: "contiguous_12_month_blocks",
  });
  queryState.savedVPW = patch.vpw;
  unmount();
  renderDetail();
  expect(screen.getByLabelText("Despesas mensais")).toHaveValue("R$ 5.500");
  expect(screen.getByLabelText("Idade alvo")).toHaveValue("100 anos");
  expect(
    screen.queryByRole("button", { name: "Salvar alterações" }),
  ).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Premissas avançadas" }),
  );
  expect(
    screen.getByLabelText("Preservar sequências históricas de 12 meses"),
  ).toBeChecked();
  expect(screen.getByLabelText("Anos extras de acumulação")).toHaveValue(
    "1 anos",
  );
});

it("saves inactive VPW without changing the active FIRE strategy", async () => {
  queryState.selectedMethod = "fire";
  vi.stubGlobal(
    "Worker",
    class {
      postMessage() {}
      terminate() {}
    },
  );
  renderDetail();
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar alterações" }),
  );
  expect(queryState.mutate).toHaveBeenCalledTimes(1);
  expect(queryState.mutate.mock.calls[0][0]).toEqual({
    vpw: expect.objectContaining({ monthly_expenses_override: 5500 }),
  });
  expect(
    screen.getByRole("button", { name: "Selecionar como ativa" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Selecionar como ativa" }),
  );
  expect(queryState.mutate).toHaveBeenLastCalledWith({ selected_method: "vpw" });
});

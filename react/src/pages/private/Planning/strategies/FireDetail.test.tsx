import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FireSimulationResult,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "../../Home/fireSimulation";
import FireDetail from "./FireDetail";

const constantDollarResult: FireSimulationResult = {
  kind: "constant_dollar",
  output: {
    targetYears: 30,
    safeRate: 4,
    baselineSafeRate: 4,
    targetMultiplier: 25,
    fireTarget: 3_000_000,
    patrimonyInputs: {
      scenarioPatrimony: 1_000_000,
      accumulationStartingPatrimony: 1_000_000,
      scenarioProgress: 33.333,
      accumulationProgress: 33.333,
    },
    bootstrap: {
      successRate: 0.8,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    },
    rateBootstrap: {
      successRate: 0.9,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    },
    accumulation: {
      successRate: 0.9,
      medianYearsToTarget: 12,
      p10YearsToTarget: 8,
      p90YearsToTarget: 18,
      gapBands: [],
    },
  },
};

const ageInBondsResult: FireSimulationResult = {
  kind: "age_in_bonds",
  output: {
    lifestyleBootstrap: {
      successRate: 0.8,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    },
    solverState: {
      fireTarget: 3_000_000,
      targetMultiplier: 25,
      horizonFactor: 1,
      safeRate: 4,
      baselineSafeRate: 4,
      rateBootstrap: {
        successRate: 0.9,
        bands: [],
        withdrawalBands: [],
        medianDepletionYear: null,
        p10DepletionYear: null,
      },
      accumulation: {
        successRate: 0.9,
        medianYearsToTarget: 12,
        p10YearsToTarget: 8,
        p90YearsToTarget: 18,
        gapBands: [],
      },
      drawdownAtTarget: null,
      anchorAge: 52,
      status: "converged",
    },
  },
};

const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  planningData: {
    preferences: {
      selected_method: "fire" as const,
      show_age_in_bonds: false,
      fire: {
        withdrawal_rate: 4,
        target_years: 30,
        monthly_expenses_override: null,
        sampling_method: "independent_months" as const,
        us_equity_proxy: "SPY" as const,
        global_equity_proxy: "VT" as const,
        crypto_proxy: "BTC" as const,
        excluded_return_categories: [],
        historical_series_overrides: {},
      },
    },
    dateOfBirth: "1986-01-01",
  },
}));

vi.mock("../hooks", () => ({
  useSelectedMethod: () => ({ selectedMethod: "fire", isLoading: false }),
  usePlanningPreferences: () => ({
    data: mocks.planningData,
  }),
  useUpdatePlanningPreferences: () => ({
    mutate: mocks.updatePreferences,
    isPending: false,
  }),
}));

vi.mock("../fireAllocation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../fireAllocation")>()),
  useFireAllocation: () => ({
    data: {
      as_of: "2026-09-18",
      buckets: [
        {
          category: "FIXED_SELIC",
          series: "IMA_S",
          total: 1_000_000,
          assets: [],
        },
      ],
    },
    isPending: false,
  }),
}));

vi.mock("../useStrategyCommonData", () => ({
  useStrategyCommonData: () => ({
    avgExpenses: 10_000,
    expensesAvg: 10_000,
    avgRevenues: 15_000,
    derivedMonthlySavings: 5_000,
    isLoading: false,
  }),
}));

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<WorkerResponseMessage>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: WorkerRequestMessage[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerRequestMessage) {
    this.messages.push(message);
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          requestId: message.requestId,
          result:
            message.request.kind === "age_in_bonds"
              ? ageInBondsResult
              : constantDollarResult,
        },
      } as MessageEvent<WorkerResponseMessage>);
    });
  }
  terminate() {}
}

const renderPage = () => {
  const theme = createTheme();
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <FireDetail />
      </ThemeProvider>
    </MemoryRouter>,
  );
};

describe("FireDetail presentation switch", () => {
  beforeEach(() => {
    mocks.updatePreferences.mockReset();
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("defaults to New and switches views without persisting or losing drafts", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("button", { name: "New" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("fire-simulation-studio")).toBeInTheDocument();

    const rate = screen.getByRole("textbox", { name: "Taxa de retirada" });
    await user.clear(rate);
    await user.type(rate, "5");
    expect(rate).toHaveValue("5% a.a.");

    await user.click(screen.getByRole("button", { name: "Legacy" }));
    expect(
      screen.queryByTestId("fire-simulation-studio"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("fire-legacy-view")).toBeInTheDocument();
    expect(mocks.updatePreferences).not.toHaveBeenCalled();

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(FakeWorker.instances[1].messages[0].request).toMatchObject({
      kind: "constant_dollar",
      input: { withdrawalRate: 5 },
    });

    const legacyWithdrawalSlider = screen.getAllByRole("slider")[0];
    legacyWithdrawalSlider.focus();
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(3));
    expect(FakeWorker.instances[2].messages[0].request).toMatchObject({
      kind: "constant_dollar",
      input: { withdrawalRate: 4.5 },
    });

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(
      screen.getByRole("textbox", { name: "Taxa de retirada" }),
    ).toHaveValue("4,5% a.a.");
    expect(mocks.updatePreferences).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.updatePreferences).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      fire: {
        withdrawal_rate: 4.5,
        target_years: 30,
        monthly_expenses_override: null,
        sampling_method: "independent_months",
        us_equity_proxy: "SPY",
        global_equity_proxy: "VT",
        crypto_proxy: "BTC",
        excluded_return_categories: [],
        historical_series_overrides: {},
      },
      show_age_in_bonds: false,
    });
  });

  it("applies a dataset override to the next calculation and saves it only explicitly", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    await user.click(
      screen.getByRole("button", { name: "Premissas avançadas" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Configurar históricos" }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
    );
    await user.click(screen.getByRole("option", { name: /^CDI/ }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(FakeWorker.instances).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(FakeWorker.instances[1].messages[0].request.input.portfolio).toEqual(
      [
        {
          category: "FIXED_SELIC",
          series: "CDI",
          weight: 1,
          constrainsSample: true,
        },
      ],
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        fire: expect.objectContaining({
          historical_series_overrides: { "FIXED_SELIC:IMA_S": "CDI" },
        }),
      }),
    );
    await user.click(screen.getByRole("button", { name: "Legacy" }));
    await user.click(
      screen.getByRole("button", { name: "Configurar históricos" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
    ).toHaveTextContent("CDI");
    await user.click(
      screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
    );
    await user.click(screen.getByRole("option", { name: /^IMA-S/ }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() =>
      expect(
        FakeWorker.instances.at(-1)?.messages[0].request.input.portfolio,
      ).toEqual([
        {
          category: "FIXED_SELIC",
          series: "IMA_S",
          weight: 1,
          constrainsSample: true,
        },
      ]),
    );
  });

  it("preserves simulated patrimony when age in bonds switches to Legacy", async () => {
    const user = userEvent.setup();
    renderPage();

    const patrimony = screen.getByRole("textbox", { name: "Patrimônio" });
    await user.clear(patrimony);
    await user.type(patrimony, "500000");
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("R$ 500.000");

    await user.click(
      screen.getByRole("button", { name: "Premissas avançadas" }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Alocação Idade em Renda Fixa",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Legacy" }));

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("R$ 500.000");
  });
});

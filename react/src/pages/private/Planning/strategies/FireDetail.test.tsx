import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
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
        simulated_patrimony: null,
        monthly_expenses_override: null,
        sampling_method: "independent_months" as const,
        us_equity_proxy: "SPY" as const,
        global_equity_proxy: "VT" as const,
        crypto_proxy: "BTC" as const,
        excluded_return_categories: [],
        historical_series_overrides: {},
        historical_series_fallbacks: {},
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

  it("keeps header actions synchronized with saved and calculated state", async () => {
    const user = userEvent.setup();
    renderPage();
    const header = within(
      screen.getByRole("region", { name: "Ações do cenário" }),
    );
    await waitFor(() =>
      expect(
        header.queryByRole("button", { name: "Recalcular" }),
      ).not.toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: "Aumentar Patrimônio" }),
    );
    expect(header.getByRole("button", { name: "Recalcular" })).toBeEnabled();
    expect(
      header.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Resetar Patrimônio" }),
    );
    expect(
      header.queryByRole("button", { name: "Recalcular" }),
    ).not.toBeInTheDocument();
    expect(
      header.queryByRole("button", { name: "Salvar alterações" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Aumentar Patrimônio" }),
    );
    await user.click(header.getByRole("button", { name: "Recalcular" }));
    await waitFor(() =>
      expect(
        header.queryByRole("button", { name: "Recalcular" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      header.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Recalcular" })).toHaveLength(
      1,
    );
  });

  it("enables saving when only Patrimônio changes and restores it on reopening", async () => {
    const user = userEvent.setup();
    const page = renderPage();
    const input = screen.getByRole("textbox", { name: "Patrimônio" });
    await user.clear(input);
    await user.type(input, "2100000");
    const save = screen.getByRole("button", { name: "Salvar alterações" });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        fire: expect.objectContaining({ simulated_patrimony: 2100000 }),
      }),
    );
    const original = mocks.planningData.preferences.fire;
    mocks.planningData.preferences.fire = {
      ...original,
      ...mocks.updatePreferences.mock.calls[0][0].fire,
    };
    page.unmount();
    try {
      renderPage();
      expect(screen.getByRole("textbox", { name: "Patrimônio" })).toHaveValue(
        "R$ 2.100.000",
      );
      expect(
        screen.queryByRole("button", { name: "Salvar alterações" }),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Resetar Patrimônio" }),
      );
      expect(screen.getByRole("textbox", { name: "Patrimônio" })).toHaveValue(
        "R$ 1.000.000",
      );
      await user.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );
      expect(mocks.updatePreferences).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fire: expect.objectContaining({ simulated_patrimony: null }),
        }),
      );
    } finally {
      mocks.planningData.preferences.fire = original;
    }
  });

  it("renders only the current scenario with the active badge beside its title", () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: "Legacy" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New" }),
    ).not.toBeInTheDocument();
    const badge = screen.getByText("Estratégia ativa");
    expect(badge.closest('[data-testid="strategy-title"]')).toHaveTextContent(
      "Retirada constante (FIRE)",
    );
    expect(screen.getByTestId("fire-simulation-studio")).toBeInTheDocument();
  });

  it("applies a primary index change within its subgroup before explicit recalculation and saving", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    await user.click(
      screen.getByRole("button", { name: "Premissas avançadas" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Configurar históricos" }),
    );
    const primary = within(
      screen.getByRole("group", { name: "Histórico para Renda fixa Selic" }),
    );
    expect(primary.getByRole("button", { name: "Pós-fixada" })).toBeDisabled();
    expect(primary.getByRole("button", { name: "IMA-S" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
    await user.click(primary.getByRole("button", { name: "CDI" }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(FakeWorker.instances).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Recalcular" })[0]);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(
      FakeWorker.instances[1].messages[0].request.input.portfolio[0],
    ).toMatchObject({ series: "CDI", weight: 1 });
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        fire: expect.objectContaining({
          historical_series_overrides: { "FIXED_SELIC:IMA_S": "CDI" },
        }),
      }),
    );
  });

  it("saves a fallback only after Apply and explicit Save, and includes it in recalculation", async () => {
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
      screen.getByRole("button", { name: "Complementar histórico anterior" }),
    );
    const earlier = within(
      screen.getByRole("group", {
        name: "Histórico anterior para Renda fixa Selic",
      }),
    );
    await user.click(earlier.getByRole("button", { name: "Renda fixa" }));
    await user.click(earlier.getByRole("button", { name: "Pós-fixada" }));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(FakeWorker.instances).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Recalcular" })[0]);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(
      FakeWorker.instances[1].messages[0].request.input.portfolio[0],
    ).toMatchObject({ series: "IMA_S", fallbackSeries: "CDI", weight: 1 });
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        fire: expect.objectContaining({
          historical_series_fallbacks: { "FIXED_SELIC:IMA_S": "CDI" },
        }),
      }),
    );
  });

  it("preserves simulated patrimony when recalculating with age in bonds", async () => {
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
    await user.click(screen.getAllByRole("button", { name: "Recalcular" })[0]);

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("R$ 500.000");
  });
});

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConstantDollarIndicator from "../../Home/ConstantDollarIndicator";
import ConstantDollarAgeInBondsIndicator from "../../Home/ConstantDollarAgeInBondsIndicator";
import type {
  FireSimulationResult,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "../../Home/fireSimulation";
import { DEFAULT_FIRE_PREFERENCES } from "../api";
import FireSimulationStudio from "./FireSimulationStudio";
import type { FireStudioDraft } from "./fireStudioScenario";

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<WorkerResponseMessage>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: WorkerRequestMessage[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerRequestMessage) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  respond(result: FireSimulationResult) {
    const requestId = this.messages[0]?.requestId ?? 1;
    this.onmessage?.({
      data: { requestId, result },
    } as MessageEvent<WorkerResponseMessage>);
  }
}

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

const renderStudioIndicator = (onCalculationStateChange = vi.fn()) => {
  render(
    <ConstantDollarIndicator
      patrimonyTotal={1_000_000}
      avgExpenses={10_000}
      isLoading={false}
      withdrawalRate={4}
      onWithdrawalRateChange={vi.fn()}
      targetYears={30}
      onTargetYearsChange={vi.fn()}
      portfolio={[]}
      samplingMethod="independent_months"
      monthlySavings={5_000}
      simulatedPatrimony={null}
      simulatedExpenses={null}
      presentation="studio"
      onCalculationStateChange={onCalculationStateChange}
    />,
  );
  return onCalculationStateChange;
};

const renderAgeInBondsStudioIndicator = (
  onCalculationStateChange = vi.fn(),
) => {
  render(
    <ConstantDollarAgeInBondsIndicator
      patrimonyTotal={1_000_000}
      avgExpenses={10_000}
      isLoading={false}
      dateOfBirth="1986-01-01"
      withdrawalRate={4}
      onWithdrawalRateChange={vi.fn()}
      targetYears={30}
      onTargetYearsChange={vi.fn()}
      portfolio={[]}
      samplingMethod="independent_months"
      fixedIncomeTotal={600_000}
      variableIncomeTotal={400_000}
      monthlySavings={5_000}
      simulatedPatrimony={null}
      simulatedExpenses={null}
      presentation="studio"
      onCalculationStateChange={onCalculationStateChange}
    />,
  );
  return onCalculationStateChange;
};

const studioDraft: FireStudioDraft = {
  isReady: true,
  showAgeInBonds: false,
  currentAge: 40,
  patrimonyTotal: 1_000_000,
  simulatedPatrimony: null,
  avgExpenses: 10_000,
  expensesOverride: null,
  derivedMonthlySavings: 5_000,
  monthlySavingsOverride: null,
  withdrawalRate: 4,
  targetYears: 30,
  samplingMethod: "independent_months",
  portfolio: [],
};

const studioProps = {
  draft: studioDraft,
  allocation: [],
  firePreferences: DEFAULT_FIRE_PREFERENCES,
  dateOfBirth: "1986-01-01",
  fixedIncomeTotal: 600_000,
  variableIncomeTotal: 400_000,
  isPersisting: false,
  onSimulatedPatrimonyChange: vi.fn(),
  onExpensesChange: vi.fn(),
  onMonthlySavingsChange: vi.fn(),
  onWithdrawalRateChange: vi.fn(),
  onTargetYearsChange: vi.fn(),
  onSamplingMethodChange: vi.fn(),
  onShowAgeInBondsChange: vi.fn(),
  onHistoricalPreferenceChange: vi.fn(),
};

const renderStudio = (
  props: ComponentProps<typeof FireSimulationStudio> = studioProps,
) => {
  const theme = createTheme();
  return render(<FireSimulationStudio {...props} />, {
    wrapper: ({ children }) => (
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    ),
  });
};

describe("studio result presentation", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it("replaces the complete results area while calculation is pending", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const onCalculationStateChange = renderStudioIndicator();

    expect(screen.getByTestId("fire-results-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Calculando simulação…")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onCalculationStateChange).toHaveBeenLastCalledWith({
        isCalculating: true,
        error: null,
      });
    });
  });

  it("uses the same full loading presentation for age in bonds", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const onCalculationStateChange = renderAgeInBondsStudioIndicator();

    expect(screen.getByTestId("fire-results-skeleton")).toBeInTheDocument();
    await waitFor(() => {
      expect(onCalculationStateChange).toHaveBeenLastCalledWith({
        isCalculating: true,
        error: null,
      });
    });
  });

  it("replaces the skeleton with an actionable studio error", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const onCalculationStateChange = renderStudioIndicator();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));

    act(() => {
      FakeWorker.instances[0].onerror?.(new ErrorEvent("error"));
    });

    expect(
      screen.queryByTestId("fire-results-skeleton"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível recalcular a simulação. Seus valores foram preservados; tente novamente.",
    );
    expect(onCalculationStateChange).toHaveBeenLastCalledWith({
      isCalculating: false,
      error: "Erro ao calcular simulação",
    });
  });

  it("shows the same actionable error for age in bonds", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    renderAgeInBondsStudioIndicator();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));

    act(() => {
      FakeWorker.instances[0].onerror?.(new ErrorEvent("error"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível recalcular a simulação. Seus valores foram preservados; tente novamente.",
    );
  });

  it("keeps scenario inputs out of studio results after calculation", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    renderStudioIndicator();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));

    act(() => {
      FakeWorker.instances[0].respond(constantDollarResult);
    });

    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.queryByText("Taxa: 4% a.a.")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Preservar sequências históricas de 12 meses"),
    ).not.toBeInTheDocument();
  });

  it("keeps age-in-bonds scenario inputs out of studio results", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    renderAgeInBondsStudioIndicator();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));

    act(() => {
      FakeWorker.instances[0].respond(ageInBondsResult);
    });

    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.queryByText("Taxa: 4% a.a.")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Preservar sequências históricas de 12 meses"),
    ).not.toBeInTheDocument();
  });

  it("keeps draft edits out of the worker until recalculation", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
    const { rerender } = renderStudio();

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    expect(FakeWorker.instances[0].messages[0].request).toMatchObject({
      kind: "constant_dollar",
      input: { withdrawalRate: 4 },
    });

    act(() => {
      FakeWorker.instances[0].respond(constantDollarResult);
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled(),
    );

    const updatedPortfolio = [
      {
        category: "BR_EQUITY" as const,
        series: "IBOV" as const,
        weight: 1,
        constrainsSample: true,
      },
    ];
    rerender(
      <FireSimulationStudio
        {...studioProps}
        draft={{
          ...studioDraft,
          simulatedPatrimony: 1_500_000,
          expensesOverride: 12_000,
          monthlySavingsOverride: 7_000,
          withdrawalRate: 5,
          targetYears: 40,
          samplingMethod: "contiguous_12_month_blocks",
          portfolio: updatedPortfolio,
        }}
      />,
    );
    expect(FakeWorker.instances).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(FakeWorker.instances[1].messages[0].request).toMatchObject({
      kind: "constant_dollar",
      input: {
        targetYears: 40,
        portfolio: updatedPortfolio,
        samplingMethod: "contiguous_12_month_blocks",
        annualExpenses: 144_000,
        withdrawalRate: 5,
        patrimonyTotal: 1_000_000,
        simulatedPatrimony: 1_500_000,
        annualSavings: 84_000,
      },
    });
    expect(screen.getByTestId("fire-results-skeleton")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recalculando…" }),
    ).toBeDisabled();

    act(() => {
      FakeWorker.instances[1].respond(constantDollarResult);
    });
    await waitFor(() => {
      expect(
        screen.queryByTestId("fire-results-skeleton"),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled();
    });
  });

  it("keeps the edited draft available when recalculation fails", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
    const { rerender } = renderStudio();

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => {
      FakeWorker.instances[0].respond(constantDollarResult);
    });
    rerender(
      <FireSimulationStudio
        {...studioProps}
        draft={{ ...studioDraft, withdrawalRate: 5 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    act(() => {
      FakeWorker.instances[1].onerror?.(new ErrorEvent("error"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível recalcular a simulação",
    );
    expect(screen.getByText("Taxa de retirada: 5% a.a.")).toBeInTheDocument();
  });

  it("exposes the collapsed desktop state while giving space to results", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
    renderStudio();
    const studio = screen.getByTestId("fire-simulation-studio");

    expect(studio).toHaveAttribute("data-panel-collapsed", "false");
    await user.click(screen.getByRole("button", { name: "Recolher cenário" }));
    expect(studio).toHaveAttribute("data-panel-collapsed", "true");
    expect(
      screen.getByRole("button", { name: "Expandir cenário" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expandir cenário" }));
    expect(studio).toHaveAttribute("data-panel-collapsed", "false");
  });

  it("uses a full-width expandable scenario panel on narrow screens", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    renderStudio();

    expect(
      screen.queryByRole("button", { name: "Recolher cenário" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Seu cenário")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Editar cenário" }));

    expect(screen.getByText("Seu cenário")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ocultar cenário" }),
    ).toBeVisible();
  });

  it("opens and focuses historical sources from the short-period warning", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const user = userEvent.setup();
    renderStudio({
      ...studioProps,
      draft: {
        ...studioDraft,
        portfolio: [
          {
            category: "CRYPTO",
            series: "CMBI10",
            weight: 1,
            constrainsSample: true,
          },
        ],
      },
      allocation: [{ category: "CRYPTO", series: null, total: 1_000_000 }],
      firePreferences: {
        ...DEFAULT_FIRE_PREFERENCES,
        crypto_proxy: "CMBI10",
      },
    });

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => {
      FakeWorker.instances[0].respond(constantDollarResult);
    });
    await user.click(screen.getByRole("button", { name: "Recolher cenário" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O período histórico é curto",
    );

    await user.click(screen.getByRole("button", { name: "Ajustar" }));

    expect(screen.getByTestId("fire-simulation-studio")).toHaveAttribute(
      "data-panel-collapsed",
      "false",
    );
    expect(screen.getByText("Dados históricos")).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText("Dados históricos").parentElement).toHaveFocus();
    });
  });
});

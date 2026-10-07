import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import OneOverNIndicator from "./OneOverNIndicator";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../Planning/api";
import { useFireSimulationWorker } from "./useFireSimulationWorker";
const workerState = vi.hoisted(() => ({
  target: 2000000,
  medianYears: null as number | null,
}));
vi.mock("./useFireSimulationWorker", () => ({
  useFireSimulationWorker: vi.fn(() => ({
    isCalculating: false,
    error: null,
    result: {
      kind: "one_over_n",
      output: {
        targetPatrimony: workerState.target,
        targetsByYear: [2000000],
        retirement: {
          trialCount: 2000,
          successRate: 0,
          safeMonthlySpending: 0,
          minimumMonthlyIncome: { p10: 0, p50: 0, p90: 0 },
          withdrawalBands: [],
          balanceBands: [],
        },
        accumulation: {
          successRate: 0,
          medianYearsToTarget: workerState.medianYears,
          p10YearsToTarget: null,
          p90YearsToTarget: null,
          gapBands: [],
        },
      },
    },
  })),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  workerState.target = 2000000;
  workerState.medianYears = null;
});
const props = {
  allocation: [
    { category: "CASH" as const, series: "CASH" as const, total: 900000 },
    { category: "FIXED_CDI" as const, series: "CDI" as const, total: 100000 },
  ],
  preferences: DEFAULT_ONE_OVER_N_PREFERENCES,
  avgExpenses: 5000,
  avgMonthlySavings: -500,
  isLoading: false,
  dateOfBirth: "1986-01-01",
  compact: true,
};
it("uses cash-inclusive wealth and the historical worker target for progress", () => {
  render(<OneOverNIndicator {...props} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(screen.getByText("Meta: R$ 2.000.000,00")).toBeVisible();
  expect(vi.mocked(useFireSimulationWorker).mock.calls[0][0]).toMatchObject({
    kind: "one_over_n",
    input: {
      retirement: { startingBalance: 1000000 },
      accumulation: { monthlySavings: -500 },
    },
  });
});
it("does not claim readiness when data failed", () => {
  render(<OneOverNIndicator {...props} isError />);
  expect(screen.getByText(/carregar os dados/)).toBeVisible();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it("preserves the withdrawal label and one-decimal target progress", () => {
  render(
    <OneOverNIndicator
      {...props}
      allocation={[{ category: "CASH", series: "CASH", total: 1992000 }]}
    />,
  );
  expect(screen.getByText("99.6%")).toBeVisible();
  expect(screen.getByText("Retirada 1/N")).toBeVisible();
  expect(screen.queryByText("100%")).toBeNull();
});
it("shows the historical median time beside an unreached target", () => {
  workerState.medianYears = 3.5;
  render(<OneOverNIndicator {...props} />);
  expect(
    screen.getByText("Meta: R$ 2.000.000,00 (~3.5a no ritmo atual)"),
  ).toBeVisible();
});
it("omits a future time when current wealth already reaches the target", () => {
  workerState.target = 900000;
  workerState.medianYears = 3.5;
  render(<OneOverNIndicator {...props} />);
  expect(screen.getByText("Meta: R$ 900.000,00")).toBeVisible();
  expect(screen.queryByText(/no ritmo atual/)).toBeNull();
});
it("explains full annual withdrawal separately from the historical target on hover", async () => {
  render(
    <OneOverNIndicator
      {...props}
      dateOfBirth="1956-01-01"
      preferences={{ ...props.preferences, target_depletion_age: 90 }}
      allocation={[{ category: "CASH", series: "CASH", total: 600000 }]}
    />,
  );
  fireEvent.mouseOver(screen.getByText("Retirada 1/N"));
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip).toHaveTextContent("20 anos restantes");
  expect(tooltip).toHaveTextContent("Retirada: 5.0% a.a. (R$ 2.500,00/mês)");
  expect(tooltip).not.toHaveTextContent("50.0% das despesas");
  expect(tooltip).toHaveTextContent("95% das simulações históricas");
  expect(tooltip).toHaveTextContent("retirada anual é gasta integralmente");
});

it.each<[number, string]>([
  [1992000, "99.6%"],
  [1999200, "99.9%"],
  [1999800, "99.9%"],
  [2000000, "100.0%"],
  [2002000, "100.1%"],
])(
  "displays wealth %s against the target as %s without rounding into readiness",
  (wealth, displayed) => {
    render(
      <OneOverNIndicator
        {...props}
        allocation={[{ category: "CASH", series: "CASH", total: wealth }]}
      />,
    );
    expect(screen.getByText(displayed)).toBeVisible();
  },
);

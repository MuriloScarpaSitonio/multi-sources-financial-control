import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { buildOneOverNSnapshot } from "./oneOverNScenario";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../api";
import OneOverNMethodologyWalkthrough from "./OneOverNMethodologyWalkthrough";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
afterEach(cleanup);
const snapshot = buildOneOverNSnapshot({
  isReady: true,
  currentAge: 70,
  allocation: [{ category: "CASH", series: "CASH", total: 600000 }],
  preferences: DEFAULT_ONE_OVER_N_PREFERENCES,
  simulatedPatrimony: null,
  avgExpenses: 2500,
  monthlySavings: 0,
})!;
it("explains annual division inside the same four-step walkthrough", async () => {
  render(<OneOverNMethodologyWalkthrough snapshot={snapshot} output={null} />);
  expect(screen.getByText("2000 aposentados ao mesmo tempo")).toBeVisible();
  await userEvent.click(screen.getByText("Um aposentado simulado"));
  expect(screen.getByText(/R\$ 600.000 ÷ 20 anos = R\$ 30.000/)).toBeVisible();
  expect(screen.getByText(/valor integral/)).toBeVisible();
});
it("labels the ensemble chart as withdrawals rather than remaining wealth", async () => {
  const output = {
    targetPatrimony: 600000,
    targetsByYear: [600000],
    retirement: {
      trialCount: 2000,
      successRate: 0.95,
      safeMonthlySpending: 2500,
      minimumMonthlyIncome: { p10: 2500, p50: 2500, p90: 2500 },
      withdrawalBands: [{ year: 0, p10: 2500, p50: 2500, p90: 2500 }],
      balanceBands: [],
    },
    accumulation: {
      successRate: 1,
      medianYearsToTarget: 0,
      p10YearsToTarget: 0,
      p90YearsToTarget: 0,
      gapBands: [],
    },
  };
  render(
    <OneOverNMethodologyWalkthrough snapshot={snapshot} output={output} />,
  );
  await userEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  expect(
    screen.getByText("Retiradas nas simulações · média mensal de cada ano"),
  ).toBeVisible();
});

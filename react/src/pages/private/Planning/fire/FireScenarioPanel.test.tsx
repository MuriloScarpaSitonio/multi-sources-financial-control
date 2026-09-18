import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FIRE_PREFERENCES } from "../api";
import FireScenarioPanel from "./FireScenarioPanel";

const allocation = [
  { category: "BR_EQUITY", series: "IBOV", total: 900_000 },
  { category: "CRYPTO", series: null, total: 100_000 },
] as const;

const baseProps = {
  allocation,
  firePreferences: DEFAULT_FIRE_PREFERENCES,
  patrimonyTotal: 1_000_000,
  simulatedPatrimony: null,
  avgExpenses: 10_000,
  expensesOverride: null,
  derivedMonthlySavings: 5_000,
  monthlySavingsOverride: null,
  withdrawalRate: 4,
  targetYears: 30,
  samplingMethod: "independent_months" as const,
  showAgeInBonds: false,
  isCalculating: false,
  isPersisting: false,
  historicalControlsRef: createRef<HTMLDivElement>(),
  onSimulatedPatrimonyChange: vi.fn(),
  onExpensesChange: vi.fn(),
  onMonthlySavingsChange: vi.fn(),
  onWithdrawalRateChange: vi.fn(),
  onTargetYearsChange: vi.fn(),
  onSamplingMethodChange: vi.fn(),
  onShowAgeInBondsChange: vi.fn(),
  onHistoricalPreferenceChange: vi.fn(),
  onRecalculate: vi.fn(),
};

const PanelHarness = ({
  isCalculating = false,
}: {
  isCalculating?: boolean;
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <FireScenarioPanel
      {...baseProps}
      isCalculating={isCalculating}
      advancedOpen={advancedOpen}
      onAdvancedOpenChange={setAdvancedOpen}
    />
  );
};

describe("FireScenarioPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps advanced source edits separate from recalculation", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);

    expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled();
    expect(screen.queryByText("Dados históricos")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Premissas avançadas/ }),
    );
    expect(screen.getByText("Dados históricos")).toBeVisible();

    await user.click(screen.getByLabelText("Cripto"));
    expect(baseProps.onHistoricalPreferenceChange).toHaveBeenCalledWith(
      "excluded_return_categories",
      ["CRYPTO"],
    );
    expect(baseProps.onRecalculate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Recalcular" }));
    expect(baseProps.onRecalculate).toHaveBeenCalledTimes(1);
  });

  it("disables and relabels recalculation while the worker is running", () => {
    render(<PanelHarness isCalculating />);

    expect(
      screen.getByRole("button", { name: "Recalculando…" }),
    ).toBeDisabled();
  });
});

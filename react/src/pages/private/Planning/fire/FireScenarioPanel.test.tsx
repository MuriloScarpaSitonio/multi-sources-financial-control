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

  it("uses editable steppers with field-specific increments and no sliders", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const fields = [
      [
        "Patrimônio",
        baseProps.onSimulatedPatrimonyChange,
        1_100_000,
        1_000_000,
      ],
      ["Despesas mensais", baseProps.onExpensesChange, 10_500, 10_000],
      ["Aportes mensais", baseProps.onMonthlySavingsChange, 5_500, 5_000],
      ["Taxa de retirada", baseProps.onWithdrawalRateChange, 4.25, 4],
      ["Horizonte", baseProps.onTargetYearsChange, 31, 30],
    ] as const;
    for (const [label, callback, increased, original] of fields) {
      expect(screen.getByRole("textbox", { name: label })).toBeEnabled();
      await user.click(
        screen.getByRole("button", { name: `Aumentar ${label}` }),
      );
      expect(callback).toHaveBeenLastCalledWith(increased);
      await user.click(
        screen.getByRole("button", { name: `Diminuir ${label}` }),
      );
      expect(callback).toHaveBeenLastCalledWith(original);
    }
    const rate = screen.getByRole("textbox", { name: "Taxa de retirada" });
    await user.clear(rate);
    await user.type(rate, "3,75");
    await user.tab();
    expect(baseProps.onWithdrawalRateChange).toHaveBeenLastCalledWith(3.75);
    expect(baseProps.onRecalculate).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Patrimônio",
      "2099916,26",
      baseProps.onSimulatedPatrimonyChange,
      2_100_000,
      2_200_000,
      2_000_000,
    ],
    [
      "Despesas mensais",
      "1234,56",
      baseProps.onExpensesChange,
      1500,
      2000,
      1000,
    ],
    [
      "Aportes mensais",
      "1234,56",
      baseProps.onMonthlySavingsChange,
      1500,
      2000,
      1000,
    ],
    [
      "Taxa de retirada",
      "4,13",
      baseProps.onWithdrawalRateChange,
      4.25,
      4.5,
      4,
    ],
  ] as const)(
    "snaps %s to the next or previous step boundary",
    async (label, typed, callback, next, following, previous) => {
      const user = userEvent.setup();
      render(<PanelHarness />);
      const input = screen.getByRole("textbox", { name: label });
      await user.clear(input);
      await user.type(input, typed);
      await user.click(
        screen.getByRole("button", { name: `Aumentar ${label}` }),
      );
      expect(callback).toHaveBeenLastCalledWith(next);
      await user.click(
        screen.getByRole("button", { name: `Aumentar ${label}` }),
      );
      expect(callback).toHaveBeenLastCalledWith(following);
      await user.clear(input);
      await user.type(input, typed);
      await user.click(
        screen.getByRole("button", { name: `Diminuir ${label}` }),
      );
      expect(callback).toHaveBeenLastCalledWith(previous);
    },
  );

  it("keeps typed values editable while enforcing limits and supporting resets", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FireScenarioPanel
        {...baseProps}
        advancedOpen={false}
        onAdvancedOpenChange={vi.fn()}
        simulatedPatrimony={100}
        withdrawalRate={2}
        targetYears={80}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Diminuir Taxa de retirada" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Aumentar Horizonte" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Diminuir Patrimônio" }),
    );
    expect(baseProps.onSimulatedPatrimonyChange).toHaveBeenLastCalledWith(0);
    const rate = screen.getByRole("textbox", { name: "Taxa de retirada" });
    await user.clear(rate);
    await user.type(rate, "1");
    expect(baseProps.onWithdrawalRateChange).not.toHaveBeenCalled();
    await user.tab();
    expect(rate).toHaveValue("2% a.a.");
    const money = screen.getByRole("textbox", { name: "Patrimônio" });
    await user.clear(money);
    await user.type(money, "1234,56");
    expect(baseProps.onSimulatedPatrimonyChange).toHaveBeenLastCalledWith(
      1234.56,
    );
    await user.click(
      screen.getByRole("button", { name: "Resetar Patrimônio" }),
    );
    expect(baseProps.onSimulatedPatrimonyChange).toHaveBeenLastCalledWith(null);
    rerender(
      <FireScenarioPanel
        {...baseProps}
        advancedOpen={false}
        onAdvancedOpenChange={vi.fn()}
      />,
    );
    expect(money).toHaveValue("R$ 1.000.000");
    await user.clear(money);
    await user.tab();
    expect(money).toHaveValue("R$ 1.000.000");
    rerender(
      <FireScenarioPanel
        {...baseProps}
        advancedOpen={false}
        onAdvancedOpenChange={vi.fn()}
        isPersisting
      />,
    );
    expect(money).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Aumentar Patrimônio" }),
    ).toBeDisabled();
  });

  it("keeps all advanced settings collapsed while recalculation stays available", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);
    const toggle = screen.getByRole("button", { name: "Premissas avançadas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Configurar históricos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recalcular" })).toBeVisible();
    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: "Configurar históricos" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Preservar sequências históricas de 12 meses",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Alocação Idade em Renda Fixa" }),
    ).toBeEnabled();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(baseProps.onRecalculate).not.toHaveBeenCalled();
  });

  it("keeps advanced source edits separate from recalculation", async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);

    expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Premissas avançadas" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Configurar históricos" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Configurar históricos" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("combobox", { name: "Histórico para Cripto" }),
    );
    await user.click(screen.getByRole("option", { name: /CMBI 10/ }));
    expect(baseProps.onHistoricalPreferenceChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(baseProps.onHistoricalPreferenceChange).toHaveBeenCalledWith(
      "historical_series_overrides",
      { "CRYPTO:default": "CMBI10" },
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

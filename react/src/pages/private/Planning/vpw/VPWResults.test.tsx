import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import VPWResults from "./VPWResults";
import { buildVPWSnapshot } from "./vpwScenario";
import { DEFAULT_VPW_PREFERENCES } from "../api";
import type { VPWSimulationOutput } from "../../Home/vpwSimulation";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  ComposedChart: ({
    children,
    data,
  }: {
    children: ReactNode;
    data: unknown;
  }) => (
    <div role="figure" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ name, dataKey }: { name: string; dataKey: string }) => (
    <span data-series={dataKey}>{name}</span>
  ),
  CartesianGrid: () => null,
  ReferenceLine: ({ y }: { y: number }) => <span data-expenses={y} />,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const snapshot = buildVPWSnapshot({
  isReady: true,
  currentAge: 40,
  avgExpenses: 1000,
  monthlySavings: 100,
  simulatedPatrimony: 50000,
  preferences: { ...DEFAULT_VPW_PREFERENCES, target_age: 80 },
  allocation: [{ category: "FIXED_CDI", series: "CDI", total: 10000 }],
})!;
const output: VPWSimulationOutput = {
  targetPatrimony: 100000,
  retirement: {
    successRate: 0.85,
    trialCount: 100,
    safeMonthlySpending: 800,
    sustainableMonthlySpending: { p10: 800, p50: 1200, p90: 1600 },
    minimumMonthlyIncome: { p10: 100, p50: 500, p90: 1000 },
    withdrawalBands: [{ year: 0, p10: 1200, p50: 6000, p90: 12000 }],
    monthlyWithdrawalLimitBands: [
      { year: 0, p10: 1500, p50: 2000, p90: 3000 },
      { year: 1, p10: 1600, p50: 2200, p90: 3500 },
    ],
    balanceBands: [{ year: 0, p10: 50000, p50: 50000, p90: 50000 }],
  },
  accumulation: {
    successRate: 0.8,
    medianYearsToTarget: 5,
    p10YearsToTarget: 3,
    p90YearsToTarget: 7,
    gapBands: [
      { year: 0, p10: 100, p50: 200, p90: 300 },
      { year: 1, p10: 0, p50: 100, p90: 200 },
    ],
  },
};
it("shows wealth and accumulation charts like FIRE with shared scenario controls", async () => {
  render(<VPWResults snapshot={snapshot} output={output} />);
  const charts = screen.getAllByRole("figure");
  expect(charts).toHaveLength(2);
  expect(screen.queryByText("Limite de retirada VPW")).toBeNull();
  expect(
    screen.getByText(
      "Aposentadoria · trajetória do patrimônio no cenário atual",
    ),
  ).toBeVisible();
  expect(within(charts[0]).getByText("p10 (pessimista)")).toHaveAttribute(
    "data-series",
    "p10",
  );
  expect(within(charts[1]).getByText("p90 (pessimista)")).toHaveAttribute(
    "data-series",
    "p90",
  );
  expect(JSON.parse(charts[0].getAttribute("data-chart")!)).toEqual([
    { age: 40, year: 0, p10: 50000, p50: 50000, p90: 50000 },
  ]);
  await userEvent.click(screen.getByRole("checkbox", { name: "Pessimista" }));
  expect(within(charts[0]).queryByText("p10 (pessimista)")).toBeNull();
  expect(within(charts[1]).queryByText("p90 (pessimista)")).toBeNull();
  expect(within(charts[1]).getByText("p10 (otimista)")).toBeVisible();
});

it("puts scenario wealth and the retire-today assumption beside the main result", () => {
  render(<VPWResults snapshot={snapshot} output={output} />);
  expect(
    screen.getByText(/Retiradas a partir de hoje, com.*50.000,00.*80 anos/),
  ).toBeVisible();
});

const card = (label: string) => within(screen.getByText(label).parentElement!);

it("shows retirement success, worst-year income and the gap from safe spending", () => {
  render(<VPWResults snapshot={snapshot} output={output} />);
  expect(screen.getAllByText("85%")).toHaveLength(2);
  expect(screen.getByText("Plano exige cautela")).toBeVisible();
  expect(screen.getByText(/15 de 100 cenários falharam/)).toBeVisible();
  expect(
    card("Renda no pior ano · cenário pessimista").getByText("R$ 100,00/mês"),
  ).toBeVisible();
  expect(
    card("Gasto seguro estimado").getByText("R$ 800,00/mês"),
  ).toBeVisible();
  expect(
    card("Folga do gasto seguro").getByText("Faltam R$ 200,00/mês"),
  ).toBeVisible();
  expect(
    card("Quando posso começar as retiradas?").getByText("Aos 45 anos"),
  ).toBeVisible();
  expect(screen.queryByText("Idade ao final da projeção")).toBeNull();
  expect(screen.queryByText("Primeira retirada mensal")).toBeNull();
  expect(screen.queryByText("Despesas mensais")).toBeNull();
});

it("keeps actual wealth progress separate from the simulated target comparison", () => {
  const s = {
    ...snapshot,
    actualPatrimony: 10000,
    patrimony: 50000,
  };
  render(
    <VPWResults snapshot={s} output={{ ...output, targetPatrimony: 20000 }} />,
  );
  expect(card("Patrimônio atual").getByText("R$ 10.000,00")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(card("Patrimônio atual").getByText("50%")).toBeVisible();
  expect(card("Meta VPW").getByText("150% acima da meta")).toBeVisible();
});

it("uses actual wealth for today's eligibility even without contributions", () => {
  render(
    <VPWResults
      snapshot={{ ...snapshot, actualPatrimony: output.targetPatrimony }}
      output={{ ...output, accumulation: null }}
    />,
  );
  expect(
    card("Quando posso começar as retiradas?").getByText("Hoje"),
  ).toBeVisible();
});

it("does not invent a retirement age when the target is not reached", () => {
  render(
    <VPWResults
      snapshot={snapshot}
      output={{
        ...output,
        accumulation: {
          ...output.accumulation!,
          medianYearsToTarget: null,
          successRate: 0,
        },
      }}
    />,
  );
  expect(
    card("Quando posso começar as retiradas?").getByText("Meta não alcançada"),
  ).toBeVisible();
});

it("shows extra-year retirement timing and identifies the conditional success rate", () => {
  const extended = {
    extraYears: 2,
    retirementStartRate: 0.5,
    retirementTrialCount: 50,
    medianYearsToRetirement: 7,
    medianStartingBalance: 80000,
    initialMonthlyIncome: { p10: 1000, p50: 1000, p90: 1000 },
  };
  render(
    <VPWResults
      snapshot={snapshot}
      output={{
        ...output,
        extendedAccumulation: extended,
        retirement: { ...output.retirement, trialCount: 50, successRate: 0.8 },
      }}
    />,
  );
  expect(
    card("Quando posso começar as retiradas?").getByText("Aos 47 anos"),
  ).toBeVisible();
  expect(screen.getByText(/consideram apenas essas simulações/)).toBeVisible();
});

it("keeps unavailable estimates empty when no simulation starts retirement", () => {
  render(
    <VPWResults
      snapshot={snapshot}
      output={{
        ...output,
        extendedAccumulation: {
          extraYears: 9,
          retirementStartRate: 0,
          retirementTrialCount: 0,
          medianYearsToRetirement: null,
          medianStartingBalance: null,
          initialMonthlyIncome: null,
        },
        retirement: {
          ...output.retirement,
          trialCount: 0,
          successRate: null,
          safeMonthlySpending: null,
          sustainableMonthlySpending: null,
        },
      }}
    />,
  );
  expect(card("Gasto seguro estimado").getByText("—")).toBeVisible();
  expect(card("Folga do gasto seguro").getByText("—")).toBeVisible();
  expect(
    card("Quando posso começar as retiradas?").getByText(
      "Sem início de retiradas",
    ),
  ).toBeVisible();
});

it("hides the financial amounts and target progress in the cards", () => {
  localStorage.setItem("hideValues", "true");
  render(<VPWResults snapshot={snapshot} output={output} />);
  for (const label of [
    "Patrimônio atual",
    "Meta VPW",
    "Renda no pior ano · cenário pessimista",
    "Gasto seguro estimado",
    "Quando posso começar as retiradas?",
    "Folga do gasto seguro",
  ]) {
    expect(card(label).getAllByText("***").length).toBeGreaterThan(0);
  }
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "***",
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.queryByText("85%")).toBeNull();
  const table = within(
    screen.getByRole("table", { name: "Gasto mensal sustentável" }),
  );
  expect(table.getAllByText("***")).toHaveLength(6);
});

it("uses FIRE's single headline sentence and preserves fractional success", () => {
  render(
    <VPWResults
      snapshot={snapshot}
      output={{
        ...output,
        retirement: {
          ...output.retirement,
          successRate: 1497 / 1500,
          trialCount: 1500,
        },
      }}
    />,
  );
  expect(screen.getAllByText("99,8%")).toHaveLength(2);
  expect(
    screen.getByText(
      /Chance histórica de sustentar.*1.000,00.*por 40 anos se a aposentadoria começasse hoje: 3 de 1500 cenários falharam/,
    ),
  ).toBeVisible();
  expect(
    screen.queryByText("Entre as simulações que começaram as retiradas."),
  ).toBeNull();
});

it("uses the simulated 95 percent target for the card, progress and retirement eligibility", () => {
  render(
    <VPWResults
      snapshot={{ ...snapshot, actualPatrimony: 10000, patrimony: 50000 }}
      output={{
        ...output,
        targetPatrimony: 100000,
        accumulation: { ...output.accumulation!, medianYearsToTarget: 8 },
      }}
    />,
  );
  expect(card("Meta VPW").getByText("R$ 100.000,00")).toBeVisible();
  expect(card("Meta VPW").getByText("50% abaixo da meta")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "10",
  );
  expect(
    card("Quando posso começar as retiradas?").getByText("Aos 48 anos"),
  ).toBeVisible();
});

it("compares uncapped sustainable spending with expenses in each table row", () => {
  render(<VPWResults snapshot={snapshot} output={output} />);
  const table = within(
    screen.getByRole("table", { name: "Gasto mensal sustentável" }),
  );
  const pessimistic = within(table.getByRole("row", { name: /Pessimista/ }));
  expect(pessimistic.getByText("R$ 800,00")).toBeVisible();
  expect(pessimistic.getByText("Faltam R$ 200,00/mês")).toBeVisible();
  const median = within(table.getByRole("row", { name: /Mediano/ }));
  expect(median.getByText("R$ 1.200,00")).toBeVisible();
  expect(median.getByText("Sobram R$ 200,00/mês")).toBeVisible();
  expect(table.getByRole("row", { name: /Otimista/ })).toHaveTextContent(
    "Sobram R$ 600,00/mês",
  );
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import OneOverNResults from "./OneOverNResults";
import { buildOneOverNSnapshot } from "./oneOverNScenario";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../api";
import type { OneOverNSimulationOutput } from "../../Home/oneOverNSimulation";
vi.mock("recharts", async () => {
  const { createContext, useContext, cloneElement } = await import("react");
  const PointContext = createContext<unknown>(null);
  return {
    ResponsiveContainer: ({
      children,
      height,
    }: {
      children: ReactNode;
      height: number;
    }) => <div data-height={height}>{children}</div>,
    ComposedChart: ({
      children,
      data,
    }: {
      children: ReactNode;
      data: unknown[];
    }) => (
      <PointContext.Provider value={data[0]}>
        <div role="figure" data-chart={JSON.stringify(data)}>
          {children}
        </div>
      </PointContext.Provider>
    ),
    Line: ({
      dataKey,
      stroke,
      strokeWidth,
      strokeDasharray,
    }: {
      dataKey: string;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
    }) => (
      <span
        data-line={dataKey}
        data-stroke={stroke}
        data-width={strokeWidth}
        data-dash={strokeDasharray}
      />
    ),
    Bar: ({ dataKey, fill }: { dataKey: string; fill: string }) => (
      <span data-bar={dataKey} data-fill={fill} />
    ),
    Area: ({ dataKey }: { dataKey: string }) => <span data-area={dataKey} />,
    CartesianGrid: () => null,
    ReferenceLine: ({ yAxisId }: { yAxisId?: string }) => (
      <span data-reference={yAxisId} />
    ),
    Tooltip: ({ content }: { content?: ReactElement }) => {
      const point = useContext(PointContext);
      return content ? (
        cloneElement(content, { active: true, payload: [{ payload: point }] })
      ) : (
        <span>Default chart tooltip</span>
      );
    },
    XAxis: () => null,
    YAxis: ({
      yAxisId,
      stroke,
      tick,
      tickFormatter,
      label,
    }: {
      yAxisId?: string;
      stroke?: string;
      tick?: { fill: string };
      tickFormatter: (n: number) => string;
      label?: { value: string };
    }) => (
      <span
        data-axis={yAxisId ?? "wealth"}
        data-stroke={stroke}
        data-tick={tick?.fill}
      >
        {label?.value} · {tickFormatter(600000)}
      </span>
    ),
    Legend: () => <span>Default chart legend</span>,
  };
});
afterEach(cleanup);
const snapshot = buildOneOverNSnapshot({
  isReady: true,
  currentAge: 70,
  allocation: [{ category: "CASH", series: "CASH", total: 600000 }],
  preferences: { ...DEFAULT_ONE_OVER_N_PREFERENCES, target_depletion_age: 90 },
  simulatedPatrimony: null,
  avgExpenses: 2500,
  monthlySavings: -500,
})!;
const output: OneOverNSimulationOutput = {
  targetPatrimony: 600000,
  targetsByYear: [600000],
  retirement: {
    trialCount: 2000,
    successRate: 0.8,
    safeMonthlySpending: 1000,
    minimumMonthlyIncome: { p10: 1000, p50: 2000, p90: 3000 },
    withdrawalBands: [{ year: 0, p10: 4000, p50: 5000, p90: 6000 }],
    balanceBands: [
      { year: 0, p10: 600000, p50: 600000, p90: 600000 },
      { year: 20, p10: 0, p50: 0, p90: 0 },
    ],
  },
  accumulation: {
    successRate: 1,
    medianYearsToTarget: 0,
    p10YearsToTarget: 0,
    p90YearsToTarget: 0,
    gapBands: [
      { year: 0, p10: 0, p50: 0, p90: 0 },
      { year: 1, p10: 0, p50: 0, p90: 0 },
    ],
  },
};
it("uses trial minimum income rather than yearly band minima in the table", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  const table = screen.getByRole("table", { name: "Renda no pior ano" });
  for (const value of ["R$ 1.000,00", "R$ 2.000,00", "R$ 3.000,00"])
    expect(within(table).getByText(value)).toBeVisible();
  expect(within(table).queryByText("R$ 4.000,00")).toBeNull();
});
it("keeps exactly two charts even for negative cashflow", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  expect(screen.getAllByRole("figure")).toHaveLength(2);
  expect(screen.getByText(/Déficit mensal/)).toBeVisible();
  const retirement = screen.getAllByRole("figure")[0];
  const rows = JSON.parse(retirement.getAttribute("data-chart")!);
  expect(rows[0].income_p50).toBe(5000);
  expect(rows.at(-1).income_p50).toBeUndefined();
});

it("shows retirement before accumulation like FIRE and VPW", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  const [retirement, accumulation] = screen.getAllByRole("figure");
  const accumulationRows = JSON.parse(accumulation.getAttribute("data-chart")!);
  const retirementRows = JSON.parse(retirement.getAttribute("data-chart")!);
  expect(accumulationRows[0].p50).toBe(0);
  expect(retirementRows[0].p50).toBe(600000);
  expect(retirementRows[0].income_p50).toBe(5000);
});

it("opens each chart alone in full screen and keeps its plotted data", async () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  const [retirement, accumulation] = screen.getAllByRole("figure");

  fireEvent.click(
    screen.getByRole("button", { name: /Expandir gráfico: Aposentadoria/ }),
  );
  const retirementDialog = screen.getByRole("dialog");
  expect(within(retirementDialog).getAllByRole("figure")).toHaveLength(1);
  expect(
    within(retirementDialog).getByRole("figure").getAttribute("data-chart"),
  ).toBe(retirement.getAttribute("data-chart"));
  expect(
    within(retirementDialog).getByRole("figure").parentElement,
  ).toHaveAttribute("data-height", "100%");
  fireEvent.click(
    within(retirementDialog).getByRole("checkbox", { name: "Pessimista" }),
  );
  expect(
    within(retirementDialog).getByRole("checkbox", { name: "Pessimista" }),
  ).not.toBeChecked();
  expect(
    within(retirementDialog)
      .getByRole("figure")
      .querySelector('[data-line="p10"]'),
  ).toBeNull();
  fireEvent.click(
    within(retirementDialog).getByRole("button", { name: "Fechar tela cheia" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(
    screen.getByRole("button", {
      name: /Expandir gráfico: Quando posso atingir a meta/,
    }),
  );
  const accumulationDialog = screen.getByRole("dialog");
  expect(within(accumulationDialog).getAllByRole("figure")).toHaveLength(1);
  expect(
    within(accumulationDialog).getByRole("checkbox", { name: "Pessimista" }),
  ).not.toBeChecked();
  expect(
    within(accumulationDialog)
      .getByRole("figure")
      .querySelector('[data-line="p90"]'),
  ).toBeNull();
  expect(
    within(accumulationDialog).getByRole("figure").getAttribute("data-chart"),
  ).toBe(accumulation.getAttribute("data-chart"));
});

it("keeps the compact chart presentation and only shows plotted metrics", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  const retirement = screen.getAllByRole("figure")[0];
  expect(retirement.parentElement).toHaveAttribute("data-height", "220");
  expect(within(retirement).getByText(/600k/)).toBeVisible();
  expect(within(retirement).queryByText("R$/mês · 600k")).toBeNull();
  expect(within(retirement).getByText("Ano 0 (idade 70)")).toBeVisible();
  const tooltip = within(retirement).getByRole("table", {
    name: "Valores da aposentadoria",
  });
  expect(within(tooltip).getAllByRole("columnheader")).toHaveLength(2);
  expect(within(tooltip).getAllByRole("row")).toHaveLength(4);
  expect(within(tooltip).queryByText("Retirada/mês")).toBeNull();
  expect(screen.queryByText("Default chart tooltip")).toBeNull();
  expect(screen.queryByText("Default chart legend")).toBeNull();
});

it("maps compact tooltip values to each visible line and optional bar", () => {
  const largeOutput: OneOverNSimulationOutput = {
    ...output,
    retirement: {
      ...output.retirement,
      withdrawalBands: [
        { year: 43, p10: 154016.93, p50: 439849.18, p90: 1217898.17 },
      ],
      balanceBands: [
        { year: 43, p10: 25878844.31, p50: 73894662.51, p90: 204606892.04 },
      ],
    },
  };
  render(<OneOverNResults snapshot={snapshot} output={largeOutput} />);
  const retirement = screen.getAllByRole("figure")[0];
  const tooltip = within(retirement).getByRole("table", {
    name: "Valores da aposentadoria",
  });
  expect(within(retirement).getByText("Ano 43 (idade 113)")).toBeVisible();
  expect(
    within(tooltip)
      .getAllByRole("cell")
      .map((cell) => cell.textContent?.replace(/\u00a0/g, " ")),
  ).toEqual([
    "Pessimista",
    "R$ 25,9 mi",
    "Mediana",
    "R$ 73,9 mi",
    "Otimista",
    "R$ 204,6 mi",
  ]);
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar retiradas" }));
  expect(within(tooltip).getAllByRole("columnheader")).toHaveLength(3);
  expect(within(tooltip).getByText("Retirada/mês")).toBeVisible();
  expect(
    within(tooltip)
      .getAllByRole("cell")
      .map((cell) => cell.textContent?.replace(/\u00a0/g, " ")),
  ).toEqual([
    "Pessimista",
    "R$ 25,9 mi",
    "R$ 154,0 mil",
    "Mediana",
    "R$ 73,9 mi",
    "R$ 439,8 mil",
    "Otimista",
    "R$ 204,6 mi",
    "R$ 1,2 mi",
  ]);
  const cssColor = (hex: string) => {
    const element = document.createElement("span");
    element.style.color = hex;
    return element.style.color;
  };
  for (const [index, key] of ["p10", "p50", "p90"].entries()) {
    const cells = within(
      within(tooltip).getAllByRole("row")[index + 1],
    ).getAllByRole("cell") as HTMLElement[];
    expect(cells[1].style.color).toBe(
      cssColor(
        retirement
          .querySelector(`[data-line="${key}"]`)!
          .getAttribute("data-stroke")!,
      ),
    );
    expect(cells[2].style.color).toBe(
      cssColor(
        retirement
          .querySelector(`[data-bar="income_${key}"]`)!
          .getAttribute("data-fill")!,
      ),
    );
  }
});
it("shows three wealth paths without withdrawal bars by default", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  const retirement = screen.getAllByRole("figure")[0];
  expect(retirement.querySelector('[data-line="p10"]')).toHaveAttribute(
    "data-dash",
    "4 3",
  );
  expect(retirement.querySelector('[data-line="p50"]')).toHaveAttribute(
    "data-width",
    "2",
  );
  expect(retirement.querySelector('[data-line="p90"]')).toHaveAttribute(
    "data-dash",
    "4 3",
  );
  expect(retirement.querySelector("[data-bar]")).toBeNull();
  expect(retirement.querySelector("[data-area]")).toBeNull();
  expect(retirement.querySelector('[data-axis="income"]')).toBeNull();
  expect(retirement.querySelector('[data-reference="income"]')).toBeNull();
});

it("adds withdrawal bars, their scale and expense reference on demand", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  let retirement = screen.getAllByRole("figure")[0];
  const toggle = screen.getByRole("switch", { name: "Mostrar retiradas" });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(screen.getAllByRole("figure")[0]).toBe(retirement);
  expect(screen.getByRole("switch", { name: "Mostrar retiradas" })).toBe(
    toggle,
  );
  retirement = screen.getAllByRole("figure")[0];
  for (const key of ["p10", "p50", "p90"])
    expect(
      retirement.querySelector(`[data-bar="income_${key}"]`),
    ).not.toBeNull();
  expect(retirement.querySelector('[data-axis="income"]')).not.toBeNull();
  expect(retirement.querySelector('[data-reference="income"]')).not.toBeNull();
  const barColors = ["p10", "p50", "p90"].map((key) =>
    retirement
      .querySelector(`[data-bar="income_${key}"]`)!
      .getAttribute("data-fill"),
  );
  const lineColors = ["p10", "p50", "p90"].map((key) =>
    retirement
      .querySelector(`[data-line="${key}"]`)!
      .getAttribute("data-stroke"),
  );
  expect(new Set(barColors).size).toBe(3);
  expect(barColors.every((color) => !lineColors.includes(color))).toBe(true);
  expect(retirement.querySelector('[data-axis="income"]')).toHaveAttribute(
    "data-stroke",
    barColors[1]!,
  );
  expect(retirement.querySelector('[data-axis="income"]')).toHaveAttribute(
    "data-tick",
    barColors[1]!,
  );
  expect(retirement.querySelector('[data-axis="wealth"]')).not.toHaveAttribute(
    "data-tick",
    barColors[1]!,
  );
  expect(retirement.querySelector('[data-axis="wealth"]')).not.toHaveAttribute(
    "data-stroke",
    retirement
      .querySelector('[data-axis="income"]')!
      .getAttribute("data-stroke"),
  );
  expect(retirement.querySelector('[data-line="p10"]')).toHaveAttribute(
    "data-dash",
    "4 3",
  );
  const layers = Array.from(
    retirement.querySelectorAll("[data-bar], [data-line], [data-reference]"),
  ).map((element) =>
    element.hasAttribute("data-reference")
      ? "expenses"
      : element.hasAttribute("data-bar")
        ? "withdrawal"
        : "wealth",
  );
  expect(layers).toEqual([
    "withdrawal",
    "withdrawal",
    "withdrawal",
    "wealth",
    "wealth",
    "wealth",
    "expenses",
  ]);
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar retiradas" }));
  retirement = screen.getAllByRole("figure")[0];
  expect(retirement.querySelector("[data-bar]")).toBeNull();
  expect(retirement.querySelector('[data-axis="income"]')).toBeNull();
});

it("scenario controls filter both wealth lines and optional withdrawal bars", () => {
  render(<OneOverNResults snapshot={snapshot} output={output} />);
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar retiradas" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Pessimista" }));
  const retirement = screen.getAllByRole("figure")[0];
  expect(retirement.querySelector('[data-line="p10"]')).toBeNull();
  expect(retirement.querySelector('[data-bar="income_p10"]')).toBeNull();
  expect(retirement.querySelector('[data-line="p90"]')).not.toBeNull();
  expect(retirement.querySelector('[data-bar="income_p90"]')).not.toBeNull();
  expect(retirement.textContent).not.toContain("Pessimista");
  expect(retirement.textContent).toContain("Mediana");
});

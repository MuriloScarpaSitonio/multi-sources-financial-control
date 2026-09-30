import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FireStudioSnapshot } from "./fire/fireStudioScenario";
import FireMethodologyWalkthrough from "./FireMethodologyWalkthrough";

const snapshot: FireStudioSnapshot = {
  request: null,
  portfolio: [
    { category: "FIXED_CDI", series: "CDI", weight: 1, constrainsSample: true },
  ],
  patrimonyTotal: 250_000,
  effectivePatrimony: 250_000,
  monthlyExpenses: 2_000,
  monthlySavings: 500,
  withdrawalRate: 3.5,
  targetYears: 10,
  samplingMethod: "independent_months",
  showAgeInBonds: false,
  currentAge: 45,
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("hideValues");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows loading and disables redraw until the complete round is ready", async () => {
  vi.useFakeTimers();
  render(<FireMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  fireEvent.click(screen.getByRole("button", { name: "Sortear nova rodada" }));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Calculando simulação")).toBeInTheDocument();
  expect(screen.queryByText(/sobreviveram à taxa/)).not.toBeInTheDocument();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeEnabled();
  expect(
    screen.queryByLabelText("Calculando simulação"),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/sobreviveram à taxa/)).toBeInTheDocument();
});

it("cancels pending calculation when leaving the step", () => {
  vi.useFakeTimers();
  render(<FireMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  cleanup();
  expect(vi.getTimerCount()).toBe(0);
});

it("uses live scenario values and has no scenario controls", () => {
  const { rerender } = render(
    <FireMethodologyWalkthrough snapshot={snapshot} />,
  );
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByText("Patrimônio: R$ 250k")).not.toBeInTheDocument();
  expect(screen.queryByText("Despesa mensal: R$ 2k")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Taxa de referência: 3.5% a.a."),
  ).not.toBeInTheDocument();
  rerender(
    <FireMethodologyWalkthrough
      snapshot={{
        ...snapshot,
        effectivePatrimony: 500_000,
        monthlyExpenses: 4_000,
        targetYears: 25,
        withdrawalRate: 5,
        samplingMethod: "contiguous_12_month_blocks",
      }}
    />,
  );
  expect(screen.queryByText("Patrimônio: R$ 500k")).not.toBeInTheDocument();
  expect(screen.queryByText("Horizonte: 25 anos")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Taxa de referência: 5.0% a.a."),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/Sorteamos blocos de 12 meses consecutivos/),
  ).toBeInTheDocument();
});

it("hides old ensemble results immediately after a scenario edit", async () => {
  vi.useFakeTimers();
  const { rerender } = render(
    <FireMethodologyWalkthrough snapshot={snapshot} />,
  );
  fireEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(screen.getByText(/sobreviveram à taxa/)).toBeInTheDocument();
  rerender(
    <FireMethodologyWalkthrough
      snapshot={{ ...snapshot, monthlyExpenses: 3_000 }}
    />,
  );
  expect(screen.queryByText(/sobreviveram à taxa/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Calculando simulação")).toBeInTheDocument();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(screen.getByText(/sobreviveram à taxa/)).toHaveTextContent("14.4%");
});

it("explains the scope when the plan includes changing allocations and extra accumulation", () => {
  render(
    <FireMethodologyWalkthrough
      snapshot={{
        ...snapshot,
        showAgeInBonds: true,
        extraAccumulationYears: 5,
      }}
    />,
  );
  fireEvent.click(screen.getByText("Um aposentado simulado"));
  expect(
    screen.getByText(/As retiradas começam agora, sem novos aportes/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  expect(
    screen.getByText(/O conjunto inclui os anos extras de acumulação/),
  ).toBeInTheDocument();
});

it("uses the current full request for advanced scenarios and discards old worker results on edits", () => {
  const workers: MockWorker[] = [];
  class MockWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
  }
  vi.stubGlobal("Worker", MockWorker);
  const advanced: FireStudioSnapshot = {
    ...snapshot,
    extraAccumulationYears: 3,
    request: {
      kind: "constant_dollar",
      input: {
        targetYears: snapshot.targetYears,
        portfolio: snapshot.portfolio,
        samplingMethod: snapshot.samplingMethod,
        annualExpenses: snapshot.monthlyExpenses * 12,
        withdrawalRate: snapshot.withdrawalRate,
        patrimonyTotal: snapshot.patrimonyTotal,
        simulatedPatrimony: null,
        annualSavings: snapshot.monthlySavings * 12,
        extraAccumulationYears: 3,
      },
    },
  };
  const { rerender } = render(
    <FireMethodologyWalkthrough snapshot={advanced} />,
  );
  fireEvent.click(screen.getByText("2000 aposentados ao mesmo tempo"));
  expect(workers[0].postMessage).toHaveBeenCalledWith({
    requestId: 1,
    request: advanced.request,
  });
  expect(screen.getByLabelText("Calculando simulação")).toBeInTheDocument();
  const result = {
    kind: "constant_dollar",
    output: {
      bootstrap: { successRate: 0.95, bands: [] },
      extendedAccumulation: { retirementTrialCount: 1800 },
    },
  };
  act(() => workers[0].onmessage?.({ data: { requestId: 1, result } }));
  expect(screen.getByText(/1710 \/ 1800 sobreviveram/)).toBeInTheDocument();
  expect(
    screen.getByText(/1800 de 2.000 cenários iniciaram/),
  ).toBeInTheDocument();
  rerender(
    <FireMethodologyWalkthrough
      snapshot={{ ...advanced, monthlyExpenses: 3_000 }}
    />,
  );
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(
    screen.queryByText(/1710 \/ 1800 sobreviveram/),
  ).not.toBeInTheDocument();
  act(() => workers[0].onmessage?.({ data: { requestId: 1, result } }));
  expect(
    screen.queryByText(/1710 \/ 1800 sobreviveram/),
  ).not.toBeInTheDocument();
});

it("masks live monetary values when privacy mode is enabled", () => {
  localStorage.setItem("hideValues", "true");
  render(<FireMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(screen.getByText("Um aposentado simulado"));
  expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
});

it("uses readable historical names and Brazilian percentages", () => {
  render(
    <FireMethodologyWalkthrough
      snapshot={{
        ...snapshot,
        portfolio: [
          {
            category: "FIXED_IPCA",
            series: "IMA_B_5_PLUS",
            weight: 0.987,
            constrainsSample: true,
            fallbackSeries: "CDI",
          },
          {
            category: "CASH",
            series: "CASH",
            weight: 0.013,
            constrainsSample: false,
          },
        ],
      }}
    />,
  );
  const sources = screen.getByRole("button", { name: "Fontes da simulação" });
  expect(sources).toHaveAttribute("aria-expanded", "false");
  const history = screen.getByText(/Históricos selecionados:/);
  expect(history).not.toBeVisible();
  fireEvent.click(sources);
  expect(sources).toHaveAttribute("aria-expanded", "true");
  expect(history).toHaveTextContent(
    "98,7% IMA-B 5+ · acima de 5 anos (complementado por CDI)",
  );
  expect(history).toHaveTextContent("1,3% Dinheiro · sem rendimento");
  expect(history).not.toHaveTextContent("IMA_B_5_PLUS");
  expect(history).not.toHaveTextContent("CASH");
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runVPWSimulation } from "../../Home/vpwSimulation";
import { buildVPWSnapshot } from "./vpwScenario";
import { DEFAULT_VPW_PREFERENCES } from "../api";
const snapshot = buildVPWSnapshot({
  isReady: true,
  currentAge: 60,
  avgExpenses: 5000,
  monthlySavings: 1000,
  simulatedPatrimony: null,
  preferences: { ...DEFAULT_VPW_PREFERENCES, target_age: 85 },
  allocation: [
    { category: "BR_EQUITY", series: "IBOV", total: 700000 },
    { category: "FIXED_CDI", series: "CDI", total: 300000 },
  ],
})!;
import VPWMethodologyWalkthrough from "./VPWMethodologyWalkthrough";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
vi.mock("../../Home/useFireSimulationWorker", () => ({
  useFireSimulationWorker: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(useFireSimulationWorker).mockReturnValue({
    result: null,
    isCalculating: true,
    error: null,
  });
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
  vi.unstubAllGlobals();
});
it("navigates four steps and keeps simulations lazy until the ensemble", () => {
  render(<VPWMethodologyWalkthrough snapshot={snapshot} />);
  expect(
    screen.getByText(/Os 4 passos mostram como sua carteira e seu cenário/),
  ).toBeVisible();
  expect(useFireSimulationWorker).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.getByText(/Resultado deste aposentado/)).toBeVisible();
  expect(useFireSimulationWorker).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
  expect(screen.getByLabelText("Calculando cenário VPW")).toBeVisible();
  expect(vi.mocked(useFireSimulationWorker).mock.lastCall?.[0]?.kind).toBe(
    "vpw",
  );
  fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
  expect(screen.getByLabelText("Calculando cenário VPW")).toBeVisible();
  expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
});
it("reports simulation failure without presenting stale example results", () => {
  vi.mocked(useFireSimulationWorker).mockReturnValue({
    result: null,
    isCalculating: false,
    error: "failed",
  });
  render(<VPWMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(
    screen.getByRole("button", { name: "2000 aposentados ao mesmo tempo" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Não foi possível calcular o cenário",
  );
});

it("ends the explanation at the calculated target without a separate test action", () => {
  const output = runVPWSimulation(snapshot.request.input);
  vi.mocked(useFireSimulationWorker).mockReturnValue({
    result: { kind: "vpw", output },
    isCalculating: false,
    error: null,
  });
  render(<VPWMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Procurando a meta VPW" }),
  );
  expect(
    screen.getByRole("list", { name: "Como chegamos à meta VPW" }),
  ).toBeVisible();
  expect(screen.getByText("1 · Retiradas desde hoje")).toBeVisible();
  expect(screen.getByText("2 · Critério da meta")).toBeVisible();
  expect(screen.getByText("3 · Meta encontrada")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Testar patrimônio na meta" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Voltar a R$ 1 milhão" }),
  ).toBeNull();
  const request = vi.mocked(useFireSimulationWorker).mock.lastCall?.[0];
  expect(request?.kind).toBe("vpw");
  if (request?.kind !== "vpw") throw new Error("Expected VPW request");
  expect(request.input.retirement.startingBalance).toBe(1000000);
});

it("uses edited scenario values and exposes no independent sliders or toggle", () => {
  const { rerender } = render(
    <VPWMethodologyWalkthrough snapshot={snapshot} />,
  );
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "2000 aposentados ao mesmo tempo" }),
  );
  const changed = {
    ...snapshot,
    patrimony: 1500000,
    monthlyExpenses: 7000,
    request: {
      ...snapshot.request,
      input: {
        ...snapshot.request.input,
        samplingMethod: "contiguous_12_month_blocks" as const,
        retirement: {
          ...snapshot.request.input.retirement,
          startingBalance: 1500000,
          monthlySpending: 7000,
        },
      },
    },
  };
  rerender(<VPWMethodologyWalkthrough snapshot={changed} />);
  expect(vi.mocked(useFireSimulationWorker).mock.lastCall?.[0]).toEqual(
    changed.request,
  );
  expect(
    screen.queryByText(/Usamos os valores de Seu cenário/),
  ).not.toBeInTheDocument();
});

it("handles a plan where no simulation starts retirement without inventing a success rate", () => {
  const output = runVPWSimulation(snapshot.request.input);
  output.retirement.successRate = null;
  output.retirement.trialCount = 0;
  output.retirement.balanceBands = [];
  vi.mocked(useFireSimulationWorker).mockReturnValue({
    result: { kind: "vpw", output },
    isCalculating: false,
    error: null,
  });
  render(<VPWMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(
    screen.getByRole("button", { name: "2000 aposentados ao mesmo tempo" }),
  );
  expect(
    screen.getByText(/Nenhuma sequência iniciou as retiradas/),
  ).toBeVisible();
  expect(
    screen.queryByText("0% das simulações cobriram todos os meses."),
  ).toBeNull();
});

it("masks live financial values when privacy mode is enabled", () => {
  localStorage.setItem("hideValues", "true");
  const output = runVPWSimulation(snapshot.request.input);
  vi.mocked(useFireSimulationWorker).mockReturnValue({
    result: { kind: "vpw", output },
    isCalculating: false,
    error: null,
  });
  render(<VPWMethodologyWalkthrough snapshot={snapshot} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Procurando a meta VPW" }),
  );
  expect(screen.queryByText(/R\$ 1.000.000,00/)).toBeNull();
  expect(screen.queryByText(/R\$ 5.000,00/)).toBeNull();
  expect(screen.getAllByText("***").length).toBeGreaterThan(0);
});

it("uses readable historical names and Brazilian percentages", () => {
  render(
    <VPWMethodologyWalkthrough
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

import { useState } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VPWStudio from "./VPWStudio";
import { DEFAULT_VPW_PREFERENCES } from "../api";
import type { VPWDraft } from "./vpwScenario";
import type {
  VPWSimulationRequest,
  VPWSimulationResult,
} from "../../Home/fireSimulation";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  message!: { requestId: number; request: VPWSimulationRequest };
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: typeof this.message) {
    this.message = message;
  }
  terminated = false;
  terminate() {
    this.terminated = true;
  }
  respond(result: VPWSimulationResult) {
    this.onmessage?.({
      data: { requestId: this.message.requestId, result },
    } as MessageEvent);
  }
}
const draft: VPWDraft = {
  isReady: true,
  currentAge: 80,
  avgExpenses: 10000,
  monthlySavings: 1,
  simulatedPatrimony: null,
  preferences: { ...DEFAULT_VPW_PREFERENCES, target_age: 82 },
  allocation: [{ category: "FIXED_CDI", series: "CDI", total: 100000 }],
};
const result: VPWSimulationResult = {
  kind: "vpw",
  output: {
    targetPatrimony: 200000,
    retirement: {
      successRate: 0,
      trialCount: 1500,
      safeMonthlySpending: 0,
      sustainableMonthlySpending: { p10: 0, p50: 200, p90: 300 },
      withdrawalBands: [{ year: 0, p10: 12000, p50: 24000, p90: 36000 }],
      monthlyWithdrawalLimitBands: [
        { year: 0, p10: 1500, p50: 2500, p90: 3500 },
      ],
      balanceBands: [],
      minimumMonthlyIncome: { p10: 0, p50: 200, p90: 300 },
    },
    accumulation: {
      successRate: 0,
      medianYearsToTarget: null,
      p10YearsToTarget: null,
      p90YearsToTarget: null,
      gapBands: [],
    },
  },
};
function Harness({ initial = draft }: { initial?: VPWDraft }) {
  const [state, setState] = useState(initial);
  return (
    <ThemeProvider theme={createTheme()}>
      <VPWStudio
        draft={state}
        isPersisting={false}
        onPreferencesChange={(preferences) =>
          setState((s) => ({
            ...s,
            preferences: { ...s.preferences, ...preferences },
          }))
        }
        onPatrimonyChange={(simulatedPatrimony) =>
          setState((s) => ({ ...s, simulatedPatrimony }))
        }
      />
    </ThemeProvider>
  );
}
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
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
  vi.unstubAllGlobals();
});
describe("VPW page integration", () => {
  it("submits a VPW worker job and keeps edits separate until Recalculate", async () => {
    render(<Harness />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    expect(FakeWorker.instances[0].message.request.kind).toBe("vpw");
    act(() => FakeWorker.instances[0].respond(result));
    expect(screen.getByText("Seu cenário")).toBeVisible();
    expect(screen.queryByText(/Retorno RV/)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
    );
    expect(FakeWorker.instances).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Recalcular" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(
      FakeWorker.instances[1].message.request.input.retirement.monthlySpending,
    ).toBe(10500);
  });
  it("displays sustainable spending, including zero, and actual accumulation horizon", async () => {
    render(<Harness />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => FakeWorker.instances[0].respond(result));
    const table = screen.getByRole("table", {
      name: "Gasto mensal sustentável",
    });
    expect(within(table).getByText("R$ 0,00")).toBeVisible();
    expect(within(table).getByText("R$ 200,00")).toBeVisible();
    expect(screen.getByText(/meta não atingida em 1 ano/i)).toBeVisible();
    expect(screen.getByText(/sucesso 0,0% em 1a/)).toBeVisible();
  });
  it("keeps target age editable when a saved value is below the current age", async () => {
    render(
      <Harness
        initial={{
          ...draft,
          preferences: { ...draft.preferences, target_age: 70 },
        }}
      />,
    );
    expect(screen.getByLabelText("Idade alvo")).toBeEnabled();
    expect(FakeWorker.instances).toHaveLength(0);
    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Idade alvo" }),
    );
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    expect(FakeWorker.instances[0].message.request.input.retirement.years).toBe(
      1,
    );
  });
  it("keeps controls available after a worker failure and supports retry", async () => {
    render(<Harness />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => FakeWorker.instances[0].onerror?.());
    expect(screen.getByRole("alert")).toHaveTextContent(/tente novamente/i);
    await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
  });
  it("suppresses timing without positive savings and keeps the target", async () => {
    render(<Harness initial={{ ...draft, monthlySavings: 0 }} />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() =>
      FakeWorker.instances[0].respond({
        ...result,
        output: { ...result.output, accumulation: null },
      }),
    );
    expect(screen.getByText(/aporte mensal positivo/i)).toBeVisible();
    expect(screen.getByText("Meta VPW")).toBeVisible();
  });
  it("bounds typed ages and keeps the existing maximum explicit", async () => {
    const { unmount } = render(
      <Harness
        initial={{
          ...draft,
          preferences: { ...draft.preferences, target_age: 70 },
        }}
      />,
    );
    const field = screen.getByLabelText("Idade alvo");
    await userEvent.clear(field);
    await userEvent.type(field, "80");
    expect(FakeWorker.instances).toHaveLength(0);
    await userEvent.tab();
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    expect(FakeWorker.instances[0].message.request.input.retirement.years).toBe(
      1,
    );
    unmount();
    render(<Harness initial={{ ...draft, currentAge: 105 }} />);
    expect(screen.getByLabelText("Idade alvo")).toBeDisabled();
    expect(screen.getByText(/limite de 105 anos/)).toBeVisible();
  });
  it("keeps the inputs editable during a worker calculation", async () => {
    render(<Harness />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
    );
    expect(screen.getByLabelText("Despesas mensais")).toHaveValue("R$ 10.500");
    expect(
      screen.getByRole("button", { name: "Recalculando…" }),
    ).toBeDisabled();
    expect(FakeWorker.instances).toHaveLength(1);
  });
  it("sends the selected block sampler on recalculation", async () => {
    render(<Harness />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => FakeWorker.instances[0].respond(result));
    await userEvent.click(
      screen.getByRole("button", { name: "Premissas avançadas" }),
    );
    await userEvent.click(
      screen.getByLabelText("Preservar sequências históricas de 12 meses"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(FakeWorker.instances[1].message.request.input.samplingMethod).toBe(
      "contiguous_12_month_blocks",
    );
  });
});

it("offers an expandable full-width scenario on mobile", async () => {
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
  render(<Harness />);
  expect(screen.queryByText("Seu cenário")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Editar cenário" }));
  expect(screen.getByText("Seu cenário")).toBeVisible();
  expect(screen.getByLabelText("Despesas mensais")).toBeEnabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Ocultar cenário" }),
  );
  expect(screen.queryByText("Seu cenário")).toBeNull();
});

it("uses FIRE result cards without the rejected banner and removes the RV control", async () => {
  render(<Harness />);
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  act(() => FakeWorker.instances[0].respond(result));
  expect(screen.getByText("Resultado da simulação")).toBeVisible();
  expect(screen.getByText("Patrimônio atual")).toBeVisible();
  expect(screen.getByText("Meta VPW")).toBeVisible();
  expect(screen.getByText("Quando posso começar as retiradas?")).toBeVisible();
  expect(screen.queryByText("Retirada mensal inicial")).toBeNull();
  expect(screen.queryByText(/Cobre .*dos gastos mensais/)).toBeNull();
  expect(screen.queryByText(/composição dos ativos|Saldo em conta/)).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Premissas avançadas" }),
  );
  expect(screen.queryByLabelText("Renda variável")).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Anos extras de acumulação" }),
  );
  expect(FakeWorker.instances).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
  expect(
    FakeWorker.instances[1].message.request.input.extraAccumulationYears,
  ).toBe(1);
  expect(FakeWorker.instances[1].message.request.input.retirement.years).toBe(
    2,
  );
});
it("does not show retirement income when no trial completes extra accumulation", async () => {
  render(
    <Harness
      initial={{
        ...draft,
        preferences: { ...draft.preferences, extra_accumulation_years: 1 },
      }}
    />,
  );
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  act(() =>
    FakeWorker.instances[0].respond({
      ...result,
      output: {
        ...result.output,
        retirement: {
          ...result.output.retirement,
          withdrawalBands: [],
          monthlyWithdrawalLimitBands: [],
        },
        extendedAccumulation: {
          extraYears: 1,
          retirementStartRate: 0,
          retirementTrialCount: 0,
          medianYearsToRetirement: null,
          medianStartingBalance: null,
          initialMonthlyIncome: null,
        },
      },
    }),
  );
  expect(screen.getByText(/Nenhuma simulação completou/)).toBeVisible();
  expect(
    screen.queryByRole("table", { name: "Gasto mensal sustentável" }),
  ).toBeNull();
  expect(screen.queryByText("Primeira retirada mensal")).toBeNull();
});

it("explains when the 95 percent target requires contributions instead of asking for a retry", async () => {
  render(<Harness />);
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  const worker = FakeWorker.instances[0];
  const error =
    "Informe um aporte mensal positivo para atingir a meta VPW de 95% antes dos anos extras de acumulação.";
  act(() =>
    worker.onmessage?.({
      data: { requestId: worker.message.requestId, error },
    } as MessageEvent),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(error);
  expect(screen.getByRole("alert")).not.toHaveTextContent(/tente novamente/i);
  expect(screen.getByLabelText("Aportes mensais")).toBeEnabled();
});

it("compares submitted history independently and preserves the baseline on failure and close", async () => {
  const user = userEvent.setup();
  render(
    <Harness
      initial={{
        ...draft,
        allocation: [
          { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 100000 },
        ],
        preferences: {
          ...draft.preferences,
          historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
        },
      }}
    />,
  );
  expect(screen.getByText("Histórico complementado")).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Comparar sem complemento",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  act(() => FakeWorker.instances[0].respond(result));
  await user.click(
    screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Comparar sem complemento" }),
  );
  expect(FakeWorker.instances).toHaveLength(2);
  const comparison = FakeWorker.instances[1];
  expect(
    comparison.message.request.input.portfolio.every(
      (slice) => !slice.fallbackSeries,
    ),
  ).toBe(true);
  expect(comparison.message.request.input.retirement.monthlySpending).toBe(
    10000,
  );
  expect(screen.getByText("Com complemento")).toBeTruthy();
  expect(screen.getByText("Sem complemento")).toBeTruthy();
  act(() => comparison.onerror?.());
  expect(
    screen.getByText(/O resultado com complemento foi preservado/),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Fechar comparação" }));
  expect(comparison.terminated).toBe(true);
  expect(
    screen.queryByRole("region", { name: "Comparação de históricos" }),
  ).toBeNull();
  expect(FakeWorker.instances).toHaveLength(2);
  await user.click(
    screen.getByRole("button", { name: "Comparar sem complemento" }),
  );
  const retry = FakeWorker.instances[2];
  act(() => retry.respond(result));
  expect(
    within(
      screen.getByRole("region", { name: "Comparação de históricos" }),
    ).getAllByText("Meta VPW"),
  ).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Recalcular" }));
  expect(retry.terminated).toBe(true);
  expect(
    screen.queryByRole("region", { name: "Comparação de históricos" }),
  ).toBeNull();
  expect(
    FakeWorker.instances.at(-1)!.message.request.input.retirement
      .monthlySpending,
  ).toBe(10500);
});
it("does not offer comparison when no complementary history is used", () => {
  render(<Harness />);
  expect(screen.queryByText("Histórico complementado")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Comparar sem complemento" }),
  ).toBeNull();
});

import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OneOverNStudio from "./OneOverNStudio";
import { DEFAULT_ONE_OVER_N_PREFERENCES } from "../api";
import type { OneOverNDraft } from "./oneOverNScenario";
import type {
  OneOverNSimulationRequest,
  OneOverNSimulationResult,
} from "../../Home/fireSimulation";
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  message!: { requestId: number; request: OneOverNSimulationRequest };
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: typeof this.message) {
    this.message = message;
  }
  terminate() {}
  respond(result: OneOverNSimulationResult) {
    this.onmessage?.({
      data: { requestId: this.message.requestId, result },
    } as MessageEvent);
  }
}
const draft: OneOverNDraft = {
  isReady: true,
  currentAge: 80,
  avgExpenses: 2500,
  monthlySavings: -500,
  simulatedPatrimony: null,
  preferences: { ...DEFAULT_ONE_OVER_N_PREFERENCES, target_depletion_age: 90 },
  allocation: [{ category: "CASH", series: "CASH", total: 600000 }],
};
const result: OneOverNSimulationResult = {
  kind: "one_over_n",
  output: {
    targetPatrimony: 300000,
    targetsByYear: [300000],
    retirement: {
      trialCount: 2000,
      successRate: 1,
      safeMonthlySpending: 5000,
      minimumMonthlyIncome: { p10: 5000, p50: 5000, p90: 5000 },
      withdrawalBands: [],
      balanceBands: [],
    },
    accumulation: {
      successRate: 1,
      medianYearsToTarget: 0,
      p10YearsToTarget: 0,
      p90YearsToTarget: 0,
      gapBands: [],
    },
  },
};
function Harness({
  initial = draft,
  dataError = false,
  onRetry = () => {},
  isReady,
}: {
  initial?: OneOverNDraft;
  dataError?: boolean;
  onRetry?: () => void;
  isReady?: boolean;
}) {
  const [state, setState] = useState(initial);
  return (
    <ThemeProvider theme={createTheme()}>
      <OneOverNStudio
        draft={{ ...state, isReady: isReady ?? state.isReady }}
        dataError={dataError}
        isPersisting={false}
        onRetryData={onRetry}
        onPreferencesChange={(p) =>
          setState((s) => ({ ...s, preferences: { ...s.preferences, ...p } }))
        }
        onPatrimonyChange={(v) =>
          setState((s) => ({ ...s, simulatedPatrimony: v }))
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
it("keeps signed drafts separate until explicit recalculation", async () => {
  render(<Harness />);
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  expect(
    FakeWorker.instances[0].message.request.input.accumulation.monthlySavings,
  ).toBe(-500);
  expect(screen.getByLabelText("Aportes mensais")).toHaveValue("-R$ 500");
  act(() => FakeWorker.instances[0].respond(result));
  await userEvent.click(
    screen.getByRole("button", { name: "Aumentar Despesas mensais" }),
  );
  expect(FakeWorker.instances).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
  expect(
    FakeWorker.instances[1].message.request.input.retirement.monthlyExpenses,
  ).toBe(3000);
});
it("blocks missing-data success and offers retry", async () => {
  const retry = vi.fn();
  render(
    <Harness
      initial={{ ...draft, isReady: false }}
      dataError
      onRetry={retry}
    />,
  );
  expect(FakeWorker.instances).toHaveLength(0);
  expect(screen.getByRole("alert")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar novamente" }),
  );
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText("Plano historicamente robusto")).toBeNull();
});
it("keeps a saved invalid target editable", async () => {
  render(
    <Harness
      initial={{
        ...draft,
        preferences: { ...draft.preferences, target_depletion_age: 70 },
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
it("lets an identical scenario retry after a worker error", async () => {
  render(<Harness />);
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  act(() => FakeWorker.instances[0].onerror?.());
  await userEvent.click(screen.getByRole("button", { name: "Recalcular" }));
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
});

it.each(["error", "loading"])(
  "hides stale comparison when required data becomes %s",
  async (state) => {
    const initial: OneOverNDraft = {
      ...draft,
      allocation: [
        { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 600000 },
      ],
      preferences: {
        ...draft.preferences,
        historical_series_fallbacks: { "FIXED_IPCA:IMA_B_5_PLUS": "IBOV" },
      },
    };
    const retry = vi.fn();
    const { rerender } = render(<Harness initial={initial} onRetry={retry} />);
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    act(() => FakeWorker.instances[0].respond(result));
    await userEvent.click(
      screen.getByRole("button", { name: "Comparar sem complemento" }),
    );
    expect(
      screen.getByRole("region", { name: "Comparação de históricos" }),
    ).toBeVisible();
    rerender(
      <Harness
        initial={initial}
        isReady={state !== "loading"}
        dataError={state === "error"}
        onRetry={retry}
      />,
    );
    if (state === "error") {
      expect(screen.getByRole("alert")).toBeVisible();
      await userEvent.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );
      expect(retry).toHaveBeenCalledOnce();
    }
    expect(
      screen.queryByRole("region", { name: "Comparação de históricos" }),
    ).toBeNull();
  },
);

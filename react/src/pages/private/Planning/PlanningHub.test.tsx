import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlanningHub from "./PlanningHub";
const state = vi.hoisted(() => ({
  revenueError: false,
  messages: [] as {
    request: {
      kind: string;
      input: {
        retirement: { startingBalance: number };
        accumulation: { monthlySavings: number };
      };
    };
  }[],
}));
vi.mock("./hooks", () => ({
  useSelectedMethod: () => ({ selectedMethod: "one_over_n" }),
  usePlanningPreferences: () => ({
    data: {
      preferences: { selected_method: "one_over_n" },
      dateOfBirth: "1986-01-01",
    },
    isError: false,
  }),
}));
vi.mock("./fireAllocation", () => ({
  useFireAllocation: () => ({
    data: {
      buckets: [
        { category: "CASH", series: "CASH", total: 900000 },
        { category: "FIXED_CDI", series: "CDI", total: 100000 },
      ],
    },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("../Assets/Indicators/hooks", () => ({
  useAssetsIndicators: () => ({ data: { total: 100000 }, isPending: false }),
}));
vi.mock("../Assets/Reports/AssetAggregationReports/hooks", () => ({
  useAssetsReports: () => ({ isPending: false }),
}));
vi.mock("../Expenses/hooks", () => ({
  useBankAccountsSummary: () => ({ data: { total: 900000 }, isPending: false }),
}));
vi.mock("../Expenses/Indicators/hooks", () => ({
  useHomeExpensesIndicators: () => ({
    data: { avg: 5500, fire_avg: 5000 },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("../Revenues/hooks/useRevenuesIndicators", () => ({
  useHomeRevenuesIndicators: () => ({
    data: { avg: 5000 },
    isPending: false,
    isError: state.revenueError,
  }),
}));
vi.mock("../Incomes/Indicators/hooks", () => ({
  useIncomesAvg: () => ({ data: { avg: 0 }, isPending: false }),
}));
vi.mock("../Home/ConstantDollarIndicator", () => ({ default: () => null }));
vi.mock("../Home/DividendsOnlyIndicator", () => ({ default: () => null }));
vi.mock("../Home/VPWIndicator", () => ({ default: () => null }));
beforeEach(() => {
  state.messages = [];
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      terminate() {}
      postMessage(message: {
        requestId: number;
        request: {
          kind: string;
          input: {
            retirement: { startingBalance: number };
            accumulation: { monthlySavings: number };
          };
        };
      }) {
        state.messages.push(message);
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              requestId: message.requestId,
              result: {
                kind: "one_over_n",
                output: { targetPatrimony: 2000000 },
              },
            },
          } as MessageEvent),
        );
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.revenueError = false;
});
it("uses historical 1/N without counting bank cash twice", async () => {
  render(
    <MemoryRouter>
      <PlanningHub />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText("50.0%")).toBeVisible());
  expect(state.messages[0].request.kind).toBe("one_over_n");
  expect(state.messages[0].request.input.retirement.startingBalance).toBe(
    1000000,
  );
  expect(state.messages[0].request.input.accumulation.monthlySavings).toBe(
    -500,
  );
});
it("blocks the summary when the revenue query failed", () => {
  state.revenueError = true;
  render(
    <MemoryRouter>
      <PlanningHub />
    </MemoryRouter>,
  );
  expect(screen.getByText(/carregar os dados do 1\/N/)).toBeVisible();
  expect(state.messages).toHaveLength(0);
});

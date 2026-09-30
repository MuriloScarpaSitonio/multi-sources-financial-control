import { act, renderHook, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FireSimulationRequest,
  VPWSimulationRequest,
  FireSimulationResult,
  WorkerResponseMessage,
} from "./fireSimulation";
import { useFireSimulationWorker } from "./useFireSimulationWorker";

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<WorkerResponseMessage>) => void) | null =
    null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  respond(message: WorkerResponseMessage) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponseMessage>);
  }
}

const request = (targetYears: number): FireSimulationRequest => ({
  kind: "constant_dollar",
  input: {
    targetYears,
    portfolio: [],
    samplingMethod: "independent_months",
    annualExpenses: 0,
    withdrawalRate: 4,
    patrimonyTotal: 0,
    simulatedPatrimony: null,
    annualSavings: 0,
  },
});

const result = (targetYears: number): FireSimulationResult => ({
  kind: "constant_dollar",
  output: {
    targetYears,
    safeRate: 0,
    baselineSafeRate: 0,
    targetMultiplier: 25,
    fireTarget: 0,
    patrimonyInputs: {
      scenarioPatrimony: 0,
      accumulationStartingPatrimony: 0,
      scenarioProgress: 0,
      accumulationProgress: 0,
    },
    bootstrap: {
      successRate: 1,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    },
    rateBootstrap: {
      successRate: 1,
      bands: [],
      withdrawalBands: [],
      medianDepletionYear: null,
      p10DepletionYear: null,
    },
    accumulation: {
      successRate: 0,
      medianYearsToTarget: null,
      p10YearsToTarget: null,
      p90YearsToTarget: null,
      gapBands: [],
    },
  },
});

describe("useFireSimulationWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it("keeps the previous result visible and cancels obsolete calculations", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const { result: hook, rerender } = renderHook(
      ({ targetYears }) => {
        const simulationRequest = useMemo(
          () => request(targetYears),
          [targetYears],
        );
        return useFireSimulationWorker(simulationRequest);
      },
      { initialProps: { targetYears: 30 } },
    );

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const firstWorker = FakeWorker.instances[0];
    expect(firstWorker.messages).toEqual([
      { requestId: 1, request: request(30) },
    ]);

    act(() => {
      firstWorker.respond({ requestId: 1, result: result(30) });
    });
    expect(hook.current.result).toEqual(result(30));
    expect(hook.current.isCalculating).toBe(false);

    rerender({ targetYears: 60 });

    await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    expect(firstWorker.terminated).toBe(true);
    expect(hook.current.result).toEqual(result(30));
    expect(hook.current.isCalculating).toBe(true);
    expect(FakeWorker.instances[1].messages).toEqual([
      { requestId: 2, request: request(60) },
    ]);

    act(() => {
      firstWorker.respond({ requestId: 1, result: result(20) });
    });
    expect(hook.current.result).toEqual(result(30));
    expect(hook.current.isCalculating).toBe(true);
  });
});

it("dispatches VPW jobs and ignores errors from a cancelled calculation", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  try {
    const vpwRequest = (startingBalance: number): VPWSimulationRequest => ({
      kind: "vpw",
      input: {
        portfolio: [],
        samplingMethod: "independent_months",
        retirement: {
          startingBalance,
          monthlySpending: 500,
          years: 1,
          annualGrowth: 0,
          numTrials: 3,
        },
        accumulation: {
          startingBalance: 0,
          monthlySavings: 0,
          years: 0,
          numTrials: 3,
        },
      },
    });
    const {
      result: hook,
      rerender,
      unmount,
    } = renderHook(
      ({ balance }) => {
        const simulationRequest = useMemo(() => vpwRequest(balance), [balance]);
        return useFireSimulationWorker(simulationRequest);
      },
      { initialProps: { balance: 6000 } },
    );
    const first = FakeWorker.instances[0];
    expect(first.messages).toEqual([
      { requestId: 1, request: vpwRequest(6000) },
    ]);
    rerender({ balance: 12000 });
    const second = FakeWorker.instances[1];
    expect(first.terminated).toBe(true);
    act(() => first.onerror?.(new ErrorEvent("error")));
    expect(hook.current.error).toBeNull();
    expect(hook.current.isCalculating).toBe(true);
    act(() =>
      second.respond({
        requestId: 2,
        error: "No aligned historical months are available",
      }),
    );
    expect(hook.current.error).toBe(
      "No aligned historical months are available",
    );
    expect(hook.current.isCalculating).toBe(false);
    unmount();
    expect(second.terminated).toBe(true);
  } finally {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  }
});

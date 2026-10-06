import { useEffect, useRef, useState } from "react";

import type {
  OneOverNSimulationRequest,
  OneOverNSimulationResult,
  FireSimulationRequest,
  FireSimulationResult,
  VPWSimulationRequest,
  VPWSimulationResult,
  PlanningSimulationRequest,
  PlanningSimulationResult,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "./fireSimulation";

type SimulationWorkerState<T extends PlanningSimulationResult> = {
  result: T | null;
  isCalculating: boolean;
  error: string | null;
};

export function useFireSimulationWorker(
  request: OneOverNSimulationRequest | null,
): SimulationWorkerState<OneOverNSimulationResult>;
export function useFireSimulationWorker(
  request: FireSimulationRequest | null,
): SimulationWorkerState<FireSimulationResult>;
export function useFireSimulationWorker(
  request: VPWSimulationRequest | null,
): SimulationWorkerState<VPWSimulationResult>;
export function useFireSimulationWorker(
  request: PlanningSimulationRequest | null,
): SimulationWorkerState<PlanningSimulationResult>;
export function useFireSimulationWorker(
  request: PlanningSimulationRequest | null,
): SimulationWorkerState<PlanningSimulationResult> {
  const requestId = useRef(0);
  const [state, setState] = useState<
    SimulationWorkerState<PlanningSimulationResult>
  >({
    result: null,
    isCalculating: request !== null,
    error: null,
  });

  useEffect(() => {
    if (request === null) {
      setState((current) => ({
        ...current,
        isCalculating: false,
        error: null,
      }));
      return;
    }

    const currentRequestId = ++requestId.current;
    let active = true;
    const worker = new Worker(
      new URL("./fireSimulation.worker.ts", import.meta.url),
      { type: "module" },
    );
    setState((current) => ({
      ...current,
      isCalculating: true,
      error: null,
    }));

    worker.onmessage = (
      event: MessageEvent<WorkerResponseMessage<PlanningSimulationResult>>,
    ) => {
      if (
        !active ||
        requestId.current !== currentRequestId ||
        event.data.requestId !== currentRequestId
      ) {
        return;
      }
      if (event.data.error) {
        setState((current) => ({
          ...current,
          isCalculating: false,
          error: event.data.error ?? "Erro ao calcular simulação",
        }));
        return;
      }
      if (event.data.result) {
        setState({
          result: event.data.result,
          isCalculating: false,
          error: null,
        });
      }
    };
    worker.onerror = () => {
      if (!active || requestId.current !== currentRequestId) return;
      setState((current) => ({
        ...current,
        isCalculating: false,
        error: "Erro ao calcular simulação",
      }));
    };

    const message: WorkerRequestMessage<PlanningSimulationRequest> = {
      requestId: currentRequestId,
      request,
    };
    worker.postMessage(message);

    return () => {
      active = false;
      worker.terminate();
    };
  }, [request]);

  return state;
}

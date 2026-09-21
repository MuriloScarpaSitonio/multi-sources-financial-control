import { useEffect, useRef, useState } from "react";

import type {
  FireSimulationRequest,
  FireSimulationResult,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "./fireSimulation";

type FireSimulationWorkerState = {
  result: FireSimulationResult | null;
  isCalculating: boolean;
  error: string | null;
};

export const useFireSimulationWorker = (
  request: FireSimulationRequest | null,
): FireSimulationWorkerState => {
  const requestId = useRef(0);
  const [state, setState] = useState<FireSimulationWorkerState>({
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

    worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
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
      setState((current) => ({
        ...current,
        isCalculating: false,
        error: "Erro ao calcular simulação",
      }));
    };

    const message: WorkerRequestMessage = {
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
};

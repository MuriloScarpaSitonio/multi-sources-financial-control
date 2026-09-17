/// <reference lib="webworker" />

import {
  runFireSimulation,
  type WorkerRequestMessage,
  type WorkerResponseMessage,
} from "./fireSimulation";

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const response: WorkerResponseMessage = { requestId: event.data.requestId };
  try {
    response.result = runFireSimulation(event.data.request);
  } catch (error) {
    response.error =
      error instanceof Error ? error.message : "Erro ao calcular simulação";
  }
  worker.postMessage(response);
};

export {};

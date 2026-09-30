/// <reference lib="webworker" />

import {
  runPlanningSimulation,
  type PlanningSimulationRequest,
  type PlanningSimulationResult,
  type WorkerRequestMessage,
  type WorkerResponseMessage,
} from "./fireSimulation";

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (
  event: MessageEvent<WorkerRequestMessage<PlanningSimulationRequest>>,
) => {
  const response: WorkerResponseMessage<PlanningSimulationResult> = {
    requestId: event.data.requestId,
  };
  try {
    response.result = runPlanningSimulation(event.data.request);
  } catch (error) {
    response.error =
      error instanceof Error ? error.message : "Erro ao calcular simulação";
  }
  worker.postMessage(response);
};

export {};

import {
  findSafeWithdrawalRate,
  findSafeWithdrawalRateWithVaryingWeights,
  runAccumulationBootstrap,
  runExtendedAccumulationBootstrap,
  runBootstrap,
  runBootstrapWithVaryingWeights,
} from "./fireBootstrap";
import type {
  AccumulationResult,
  BootstrapResult,
  ExtendedAccumulationResult,
} from "./fireBootstrap";
import {
  buildFirePatrimonyInputs,
  type FirePatrimonyInputs,
} from "./fireResultPresentation";
import {
  buildAgeInBondsPortfolio,
  type PortfolioAtFn,
  type PortfolioSlice,
} from "./firePortfolio";
import type { SamplingMethod } from "./fireReturnTypes";

export type ConstantDollarSimulationInput = {
  targetYears: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  annualExpenses: number;
  withdrawalRate: number;
  patrimonyTotal: number;
  simulatedPatrimony: number | null;
  annualSavings: number;
  extraAccumulationYears?: number;
};

export type ConstantDollarSimulationOutput = {
  targetYears: number;
  extendedAccumulation?: ExtendedAccumulationResult;
  safeRate: number;
  baselineSafeRate: number;
  targetMultiplier: number;
  fireTarget: number;
  patrimonyInputs: FirePatrimonyInputs;
  bootstrap: BootstrapResult;
  rateBootstrap: BootstrapResult;
  accumulation: AccumulationResult;
};

export type SolverStatus =
  | "converged"
  | "target_delta"
  | "cycle"
  | "max_iter"
  | "unreachable";

export type AgeInBondsFireState = {
  fireTarget: number;
  targetMultiplier: number;
  horizonFactor: number;
  safeRate: number;
  baselineSafeRate: number;
  rateBootstrap: BootstrapResult;
  accumulation: AccumulationResult;
  drawdownAtTarget: BootstrapResult | null;
  anchorAge: number;
  status: SolverStatus;
};

export type AgeInBondsSimulationInput = {
  currentAge: number;
  targetYears: number;
  portfolio: readonly PortfolioSlice[];
  samplingMethod: SamplingMethod;
  effectivePatrimony: number;
  annualExpenses: number;
  annualSavings: number;
  extraAccumulationYears?: number;
  withdrawalRate: number;
};

export type AgeInBondsSimulationOutput = {
  extendedAccumulation?: ExtendedAccumulationResult;
  lifestyleBootstrap: BootstrapResult;
  solverState: AgeInBondsFireState;
};

export type FireSimulationRequest =
  | {
      kind: "constant_dollar";
      input: ConstantDollarSimulationInput;
    }
  | {
      kind: "age_in_bonds";
      input: AgeInBondsSimulationInput;
    };

export type FireSimulationResult =
  | {
      kind: "constant_dollar";
      output: ConstantDollarSimulationOutput;
    }
  | {
      kind: "age_in_bonds";
      output: AgeInBondsSimulationOutput;
    };

export type WorkerRequestMessage = {
  requestId: number;
  request: FireSimulationRequest;
};

export type WorkerResponseMessage = {
  requestId: number;
  result?: FireSimulationResult;
  error?: string;
};

const runConstantDollarSimulation = (
  input: ConstantDollarSimulationInput,
): ConstantDollarSimulationOutput => {
  const safeRate = findSafeWithdrawalRate(
    input.targetYears,
    input.portfolio,
    input.samplingMethod,
  );
  const baselineSafeRate = findSafeWithdrawalRate(
    30,
    input.portfolio,
    input.samplingMethod,
  );
  const horizonFactor =
    safeRate > 0 && baselineSafeRate > 0
      ? Math.max(1, baselineSafeRate / safeRate)
      : 1;
  const baseMultiplier =
    input.withdrawalRate > 0 ? 100 / input.withdrawalRate : 0;
  const targetMultiplier = baseMultiplier * horizonFactor;
  const fireTarget = input.annualExpenses * targetMultiplier;
  const patrimonyInputs = buildFirePatrimonyInputs({
    actualPatrimony: input.patrimonyTotal,
    simulatedPatrimony: input.simulatedPatrimony,
    fireTarget,
  });

  const extendedAccumulation =
    (input.extraAccumulationYears ?? 0) > 0
      ? runExtendedAccumulationBootstrap({
          startingBalance: patrimonyInputs.scenarioPatrimony,
          annualContribution: input.annualSavings,
          target: fireTarget,
          extraYears: input.extraAccumulationYears!,
          annualWithdrawal: input.annualExpenses,
          horizon: input.targetYears,
          portfolio: input.portfolio,
          samplingMethod: input.samplingMethod,
        })
      : undefined;

  return {
    targetYears: input.targetYears,
    safeRate,
    baselineSafeRate,
    targetMultiplier,
    fireTarget,
    patrimonyInputs,
    ...(extendedAccumulation ? { extendedAccumulation } : {}),
    bootstrap:
      extendedAccumulation?.bootstrap ??
      runBootstrap(
        patrimonyInputs.scenarioPatrimony,
        input.annualExpenses,
        input.targetYears,
        input.portfolio,
        input.samplingMethod,
      ),
    rateBootstrap: runBootstrap(
      1_000_000,
      1_000_000 * (input.withdrawalRate / 100),
      input.targetYears,
      input.portfolio,
      input.samplingMethod,
    ),
    accumulation: runAccumulationBootstrap({
      startingBalance: patrimonyInputs.accumulationStartingPatrimony,
      annualContribution: input.annualSavings,
      target: fireTarget,
      portfolio: input.portfolio,
      samplingMethod: input.samplingMethod,
    }),
  };
};

// The FIRE target depends on the retirement-age glide path, while retirement
// age depends on accumulation toward that target. Iterate until both agree.
// Cycles and the iteration cap choose the most conservative visited target.
const SOLVER_MAX_ITER = 5;
const SOLVER_TARGET_DELTA_THRESHOLD = 0.01;

const buildAgeInBondsPortfolioAt = (
  anchorAge: number,
  basePortfolio: readonly PortfolioSlice[],
): PortfolioAtFn => {
  return (yearIndex: number): readonly PortfolioSlice[] => {
    const age = anchorAge + yearIndex;
    const bondPct = Math.min(age, 100) / 100;
    return buildAgeInBondsPortfolio(basePortfolio, 1 - bondPct);
  };
};

type SolverPass = {
  anchorAge: number;
  safeRate: number;
  baselineSafeRate: number;
  horizonFactor: number;
  targetMultiplier: number;
  fireTarget: number;
  rateBootstrap: BootstrapResult;
  accumulation: AccumulationResult;
};

const pickConservative = (candidates: SolverPass[]): SolverPass =>
  candidates.reduce((best, current) => {
    if (current.fireTarget > best.fireTarget) return current;
    if (current.fireTarget === best.fireTarget) {
      const bestMedian = best.accumulation.medianYearsToTarget ?? -1;
      const currentMedian = current.accumulation.medianYearsToTarget ?? -1;
      return currentMedian > bestMedian ? current : best;
    }
    return best;
  });

const solveAgeInBondsFireState = (
  input: AgeInBondsSimulationInput,
): AgeInBondsFireState => {
  const baseMultiplier =
    input.withdrawalRate > 0 ? 100 / input.withdrawalRate : 0;

  const runOnePass = (anchorAge: number): SolverPass => {
    const portfolioAt = buildAgeInBondsPortfolioAt(anchorAge, input.portfolio);
    const safeRate = findSafeWithdrawalRateWithVaryingWeights(
      input.targetYears,
      portfolioAt,
      input.samplingMethod,
    );
    const baselineSafeRate = findSafeWithdrawalRateWithVaryingWeights(
      30,
      portfolioAt,
      input.samplingMethod,
    );
    const horizonFactor =
      safeRate > 0 && baselineSafeRate > 0
        ? Math.max(1, baselineSafeRate / safeRate)
        : 1;
    const targetMultiplier = baseMultiplier * horizonFactor;
    const fireTarget = input.annualExpenses * targetMultiplier;
    const rateBootstrap = runBootstrapWithVaryingWeights(
      1_000_000,
      1_000_000 * (input.withdrawalRate / 100),
      input.targetYears,
      portfolioAt,
      input.samplingMethod,
    );
    const accumulation = runAccumulationBootstrap({
      startingBalance: input.effectivePatrimony,
      annualContribution: input.annualSavings,
      target: fireTarget,
      portfolio: input.portfolio,
      samplingMethod: input.samplingMethod,
    });
    return {
      anchorAge,
      safeRate,
      baselineSafeRate,
      horizonFactor,
      targetMultiplier,
      fireTarget,
      rateBootstrap,
      accumulation,
    };
  };

  const visited: SolverPass[] = [];
  let nextAnchor = input.currentAge + (input.extraAccumulationYears ?? 0);
  let chosen: SolverPass | null = null;
  let status: SolverStatus = "max_iter";

  for (let index = 0; index < SOLVER_MAX_ITER; index += 1) {
    const pass = runOnePass(nextAnchor);
    if (pass.accumulation.medianYearsToTarget === null) {
      return {
        ...pass,
        drawdownAtTarget: null,
        status: "unreachable",
      };
    }

    const median = pass.accumulation.medianYearsToTarget;
    if (
      visited.length > 0 &&
      visited[visited.length - 1].accumulation.medianYearsToTarget === median
    ) {
      chosen = pass;
      status = "converged";
      break;
    }
    if (
      visited.some(
        (candidate) => candidate.accumulation.medianYearsToTarget === median,
      )
    ) {
      chosen = pickConservative([...visited, pass]);
      status = "cycle";
      break;
    }
    if (index >= 2) {
      const previous = visited[visited.length - 1];
      const delta =
        Math.abs(pass.fireTarget - previous.fireTarget) / previous.fireTarget;
      if (delta < SOLVER_TARGET_DELTA_THRESHOLD) {
        chosen = pass;
        status = "target_delta";
        break;
      }
    }

    visited.push(pass);
    nextAnchor =
      input.currentAge + median + (input.extraAccumulationYears ?? 0);
    if (index === SOLVER_MAX_ITER - 1) {
      chosen = pickConservative([...visited, pass]);
      status = "max_iter";
      break;
    }
  }

  if (chosen === null) chosen = visited[visited.length - 1];
  const finalPortfolioAt = buildAgeInBondsPortfolioAt(
    chosen.anchorAge,
    input.portfolio,
  );
  const drawdownAtTarget = runBootstrapWithVaryingWeights(
    chosen.fireTarget,
    input.annualExpenses,
    input.targetYears,
    finalPortfolioAt,
    input.samplingMethod,
  );

  return {
    ...chosen,
    drawdownAtTarget,
    status,
  };
};

const runAgeInBondsSimulation = (
  input: AgeInBondsSimulationInput,
): AgeInBondsSimulationOutput => {
  const solverState = solveAgeInBondsFireState(input);
  const extendedAccumulation =
    (input.extraAccumulationYears ?? 0) > 0
      ? runExtendedAccumulationBootstrap({
          startingBalance: input.effectivePatrimony,
          annualContribution: input.annualSavings,
          target: solverState.fireTarget,
          extraYears: input.extraAccumulationYears!,
          annualWithdrawal: input.annualExpenses,
          horizon: input.targetYears,
          portfolio: input.portfolio,
          samplingMethod: input.samplingMethod,
          retirementPortfolioAt: (elapsed, year) =>
            buildAgeInBondsPortfolioAt(
              input.currentAge + elapsed,
              input.portfolio,
            )(year),
        })
      : undefined;
  return {
    ...(extendedAccumulation ? { extendedAccumulation } : {}),
    lifestyleBootstrap:
      extendedAccumulation?.bootstrap ??
      runBootstrapWithVaryingWeights(
        input.effectivePatrimony,
        input.annualExpenses,
        input.targetYears,
        buildAgeInBondsPortfolioAt(input.currentAge, input.portfolio),
        input.samplingMethod,
      ),
    solverState: extendedAccumulation
      ? { ...solverState, drawdownAtTarget: extendedAccumulation.bootstrap }
      : solverState,
  };
};

export const runFireSimulation = (
  request: FireSimulationRequest,
): FireSimulationResult => {
  if (request.kind === "age_in_bonds") {
    return {
      kind: request.kind,
      output: runAgeInBondsSimulation(request.input),
    };
  }
  return {
    kind: request.kind,
    output: runConstantDollarSimulation(request.input),
  };
};

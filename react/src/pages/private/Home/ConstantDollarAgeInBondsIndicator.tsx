import { useMemo, useState } from "react";

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import ExpenseSimulator from "./ExpenseSimulator";
import PatrimonySimulator from "./PatrimonySimulator";
import PersistedSlider from "./PersistedSlider";
import SavingsSimulator from "./SavingsSimulator";
import {
  computeWeights,
  findSafeWithdrawalRateWithVaryingWeights,
  isIfixRestrictedSampleForVaryingWeights,
  runAccumulationBootstrap,
  runBootstrapWithVaryingWeights,
  type AccumulationResult,
  type AllocationWeights,
  type BootstrapBand,
  type BootstrapResult,
  type WeightsAtFn,
} from "./fireBootstrap";

// === Idade-em-RF fixed-point solver ===
//
// The FIRE target depends on `safeRate`, which depends on the post-retirement
// glide path, which depends on retirement age, which depends on accumulation,
// which depends on the FIRE target. For a pre-FIRE user this is a self-
// consistency problem: if I anchor `weightsAt` at `currentAge`, I'm sizing the
// target against an "if I retired today" glide that the user won't actually
// live. We iterate until the loop closes — then a single anchor age drives
// `fireTarget`, the tooltip multiplier, the "agressivo" warning, and the
// Aposentadoria preview.
//
// Convergence guards (in the order they're checked inside the loop):
// 1. **Converged** — stop on `medianYearsToTarget` unchanged from prior
//    iterate (the next anchor would equal the current one; this iterate is
//    a fixed point).
// 2. **Cycle** — if the current median appeared in any earlier (non-
//    immediately-prior) iterate, we have a 2+ cycle. Pick the most
//    conservative member across all visited iterates plus the current pass:
//    largest `fireTarget`, with later `medianYearsToTarget` as a secondary
//    tie-break. **Cycle is checked before target_delta** because a 2-cycle
//    like 8 → 10 → 8 can produce a sub-1% fireTarget swing on the third
//    pass, which would otherwise exit as `target_delta` and silently bypass
//    `pickConservative`.
// 3. **Target-delta** — only after ≥3 iterates exist and cycle didn't fire,
//    stop on `|ΔfireTarget| / fireTarget < 1%`. Single-step sub-1% moves
//    can be coincidental; requiring three iterates makes it a stability
//    signal.
// 4. **Max-iter** — hard cap at SOLVER_MAX_ITER. The mapping is
//    bootstrap-quantized and not provably contractive (or even monotonic),
//    so a cap is load-bearing. Return `pickConservative([...visited, pass])`
//    — the last iterate is **not** necessarily the highest-`fireTarget`
//    one, so returning it would silently understate the target.
// 5. **Unreachable** — if any pass produces `medianYearsToTarget === null`,
//    return immediately with `drawdownAtTarget: null` and
//    status "unreachable". Don't fall back to a current-age anchor that
//    would coherent-look an unreachable case.

type SolverStatus =
  | "converged"
  | "target_delta"
  | "cycle"
  | "max_iter"
  | "unreachable";

type AgeInBondsFireState = {
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

const SOLVER_MAX_ITER = 5;
const SOLVER_TARGET_DELTA_THRESHOLD = 0.01; // 1%

// Sentinel returned by the solver memo when `currentAge` is null (DOB not set).
// The component renders a placeholder in that branch and never reads these
// values; this exists to avoid running ~5 expensive bootstrap calls just to
// discard them.
const EMPTY_AGE_IN_BONDS_FIRE_STATE: AgeInBondsFireState = {
  fireTarget: 0,
  targetMultiplier: 0,
  horizonFactor: 1,
  safeRate: 0,
  baselineSafeRate: 0,
  rateBootstrap: {
    successRate: 0,
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
  drawdownAtTarget: null,
  anchorAge: 0,
  status: "unreachable",
};

// `excludeIfix` overrides the IFIX slot to 0 each year *without* renormalizing.
// equityRatio still reflects the real portfolio (so we don't redistribute the
// IFIX fraction onto equity), and the per-year weights then sum to less than 1
// during the stock-heavy retirement years; the missing fraction is "treat IFIX
// as cash earning 0% real". Sample window unlocks because every year's
// `weights.ifix` is 0 < MIN_WEIGHT_FOR_RETURN_SERIES.
const buildAgeInBondsWeightsAt = (
  anchorAge: number,
  equityTotal: number,
  ifixTotal: number,
  excludeIfix: boolean = false,
): WeightsAtFn => {
  const equityIfixTotal = equityTotal + ifixTotal;
  const equityRatio = equityIfixTotal > 0 ? equityTotal / equityIfixTotal : 1;
  const ifixRatio = equityIfixTotal > 0 ? ifixTotal / equityIfixTotal : 0;
  return (yearIndex: number): AllocationWeights => {
    const age = anchorAge + yearIndex;
    const bondPct = Math.min(age, 100) / 100;
    const stockPct = 1 - bondPct;
    return {
      equity: stockPct * equityRatio,
      ifix: excludeIfix ? 0 : stockPct * ifixRatio,
      fixedIncome: bondPct,
    };
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
  candidates.reduce((best, cur) => {
    if (cur.fireTarget > best.fireTarget) return cur;
    if (cur.fireTarget === best.fireTarget) {
      const bestMedian = best.accumulation.medianYearsToTarget ?? -1;
      const curMedian = cur.accumulation.medianYearsToTarget ?? -1;
      return curMedian > bestMedian ? cur : best;
    }
    return best;
  });

const solveAgeInBondsFireState = (params: {
  currentAge: number;
  equityTotal: number;
  ifixTotal: number;
  effectivePatrimony: number;
  annualExpenses: number;
  annualSavings: number;
  withdrawalRate: number;
  targetYears: number;
  accumulationWeights: AllocationWeights;
  excludeIfix: boolean;
}): AgeInBondsFireState => {
  const {
    currentAge,
    equityTotal,
    ifixTotal,
    effectivePatrimony,
    annualExpenses,
    annualSavings,
    withdrawalRate,
    targetYears,
    accumulationWeights,
    excludeIfix,
  } = params;
  const baseMultiplier = withdrawalRate > 0 ? 100 / withdrawalRate : 0;

  const runOnePass = (anchorAge: number): SolverPass => {
    const weightsAt = buildAgeInBondsWeightsAt(
      anchorAge,
      equityTotal,
      ifixTotal,
      excludeIfix,
    );
    const safeRate = findSafeWithdrawalRateWithVaryingWeights(
      targetYears,
      weightsAt,
    );
    const baselineSafeRate = findSafeWithdrawalRateWithVaryingWeights(
      30,
      weightsAt,
    );
    const horizonFactor =
      safeRate > 0 && baselineSafeRate > 0
        ? Math.max(1, baselineSafeRate / safeRate)
        : 1;
    const targetMultiplier = baseMultiplier * horizonFactor;
    const fireTarget = annualExpenses * targetMultiplier;
    const rateBootstrap = runBootstrapWithVaryingWeights(
      1_000_000,
      1_000_000 * (withdrawalRate / 100),
      targetYears,
      weightsAt,
    );
    const accumulation = runAccumulationBootstrap({
      startingBalance: effectivePatrimony,
      annualContribution: annualSavings,
      target: fireTarget,
      weights: accumulationWeights,
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
  let nextAnchor = currentAge;
  let chosen: SolverPass | null = null;
  let status: SolverStatus = "max_iter";

  for (let i = 0; i < SOLVER_MAX_ITER; i++) {
    const pass = runOnePass(nextAnchor);

    // Unreachable: stop immediately, skip the preview chart. Don't fall back
    // to the current-age anchor — that would dress an unreachable scenario
    // up as a coherent-looking projection.
    if (pass.accumulation.medianYearsToTarget === null) {
      return {
        fireTarget: pass.fireTarget,
        targetMultiplier: pass.targetMultiplier,
        horizonFactor: pass.horizonFactor,
        safeRate: pass.safeRate,
        baselineSafeRate: pass.baselineSafeRate,
        rateBootstrap: pass.rateBootstrap,
        accumulation: pass.accumulation,
        drawdownAtTarget: null,
        anchorAge: pass.anchorAge,
        status: "unreachable",
      };
    }

    const median = pass.accumulation.medianYearsToTarget;

    // Convergence: median equal to the prior iterate's median means the next
    // iteration's anchor would be identical to this one's, so this pass is a
    // fixed point.
    if (visited.length > 0) {
      const prev = visited[visited.length - 1];
      if (prev.accumulation.medianYearsToTarget === median) {
        chosen = pass;
        status = "converged";
        break;
      }
    }

    // Cycle: median appears in any prior iterate. The convergence check above
    // already handles the immediately-prior case (1-cycle), so a hit here is
    // a 2+ cycle. Pick the most conservative member across all visited
    // iterates plus the current pass.
    //
    // **Cycle is checked before target_delta** on purpose. A 2-cycle like
    // 8 → 10 → 8 can produce a sub-1% fireTarget swing on the third pass,
    // which would otherwise exit as `target_delta` and bypass
    // `pickConservative`. Cycle detection must take precedence.
    if (
      visited.some((v) => v.accumulation.medianYearsToTarget === median)
    ) {
      chosen = pickConservative([...visited, pass]);
      status = "cycle";
      break;
    }

    // Target-delta stop: only after at least 3 iterates exist (i >= 2 means
    // pass is iterate index 2 with prior iterates 0 and 1). A single-step
    // sub-1% move can be coincidental; requiring three iterates makes it a
    // stability signal rather than a single-pass artifact. Safe to evaluate
    // here only because we already ruled out cycles above.
    if (i >= 2) {
      const prev = visited[visited.length - 1];
      const delta = Math.abs(pass.fireTarget - prev.fireTarget) / prev.fireTarget;
      if (delta < SOLVER_TARGET_DELTA_THRESHOLD) {
        chosen = pass;
        status = "target_delta";
        break;
      }
    }

    visited.push(pass);
    nextAnchor = currentAge + median;

    // No early stop, last iteration → max_iter. The mapping isn't proven
    // monotonic (or even contractive), so the last pass isn't necessarily
    // the conservative answer — pick the largest-fireTarget iterate across
    // all visited (including the just-completed pass).
    if (i === SOLVER_MAX_ITER - 1) {
      chosen = pickConservative([...visited, pass]);
      status = "max_iter";
      break;
    }
  }

  // chosen is set in every break path above; the loop only exits via break.
  // Fallback for type safety only.
  if (chosen === null) chosen = visited[visited.length - 1];

  // Drawdown preview uses the same anchor as the chosen pass (i.e. the same
  // glide path that produced the converged fireTarget). This is the central
  // payoff of the solver — one anchor across target, tooltip, warning, and
  // preview.
  const finalWeightsAt = buildAgeInBondsWeightsAt(
    chosen.anchorAge,
    equityTotal,
    ifixTotal,
    excludeIfix,
  );
  const drawdownAtTarget = runBootstrapWithVaryingWeights(
    chosen.fireTarget,
    annualExpenses,
    targetYears,
    finalWeightsAt,
  );

  return {
    fireTarget: chosen.fireTarget,
    targetMultiplier: chosen.targetMultiplier,
    horizonFactor: chosen.horizonFactor,
    safeRate: chosen.safeRate,
    baselineSafeRate: chosen.baselineSafeRate,
    rateBootstrap: chosen.rateBootstrap,
    accumulation: chosen.accumulation,
    drawdownAtTarget,
    anchorAge: chosen.anchorAge,
    status,
  };
};

const ProgressBar = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

const computeAge = (dateOfBirth: string): number => {
  const birth = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
  valueFormatter = formatCurrency,
  showOtimista = true,
  showMediana = true,
  showPessimista = true,
  invertLabels = false,
}: {
  active?: boolean;
  payload?: { payload: BootstrapBand }[];
  hideValues?: boolean;
  valueFormatter?: (v: number) => string;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
  invertLabels?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  // For balance-based bands (drawdown), p10 = small balance = pessimista.
  // For gap-based bands (accumulation), p10 = small gap = otimista — invert.
  const otimistaValue = invertLabels ? data.p10 : data.p90;
  const pessimistaValue = invertLabels ? data.p90 : data.p10;
  const otimistaPercentile = invertLabels ? "p10" : "p90";
  const pessimistaPercentile = invertLabels ? "p90" : "p10";
  return (
    <Stack
      spacing={0.5}
      sx={{
        border: "1px solid",
        p: 1,
        borderColor: getColor(Colors.brand400),
        backgroundColor: getColor(Colors.neutral600),
      }}
    >
      <p style={{ color: getColor(Colors.neutral300) }}>Ano {data.year}</p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista ({pessimistaPercentile}): {hideValues ? "***" : valueFormatter(pessimistaValue)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {hideValues ? "***" : valueFormatter(data.p50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista ({otimistaPercentile}): {hideValues ? "***" : valueFormatter(otimistaValue)}
        </p>
      )}
    </Stack>
  );
};

type DrawdownPoint = {
  age: number;
  year: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  withdrawalP10: number | null;
  withdrawalP50: number | null;
  withdrawalP90: number | null;
};

const DrawdownTooltipContent = ({
  active,
  payload,
  hideValues,
  showOtimista = true,
  showMediana = true,
  showPessimista = true,
  xLabel = "Idade",
}: {
  active?: boolean;
  payload?: { payload: DrawdownPoint }[];
  hideValues?: boolean;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
  xLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmtBal = (v: number) => (hideValues ? "***" : formatCurrency(v));
  const fmtWd = (v: number | null) =>
    v === null ? "—" : hideValues ? "***" : `${formatCurrency(v / 12)}/mês`;
  return (
    <Stack
      spacing={0.5}
      sx={{
        border: "1px solid",
        p: 1,
        borderColor: getColor(Colors.brand400),
        backgroundColor: getColor(Colors.neutral600),
      }}
    >
      <p style={{ color: getColor(Colors.neutral300) }}>
        {xLabel}: {xLabel === "Idade" ? data.age : data.year}
      </p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista (p10): {fmtBal(data.balanceP10)} · {fmtWd(data.withdrawalP10)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {fmtBal(data.balanceP50)} · {fmtWd(data.withdrawalP50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p90): {fmtBal(data.balanceP90)} · {fmtWd(data.withdrawalP90)}
        </p>
      )}
    </Stack>
  );
};

const ConstantDollarAgeInBondsIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  dateOfBirth,
  withdrawalRate,
  onWithdrawalRateChange,
  targetYears,
  onTargetYearsChange,
  fixedIncomeTotal,
  variableIncomeTotal,
  equityTotal,
  ifixTotal,
  monthlySavings = 0,
  defaultMonthlySavings = 0,
  onMonthlySavingsChange,
  onMonthlySavingsReset,
  isMonthlySavingsOverridden = false,
  simulatedExpenses: simulatedExpensesProp,
  onSimulatedExpensesChange,
  excludeIfixFromSim: excludeIfixFromSimProp,
  onExcludeIfixFromSimChange,
  onProgressClick,
  compact = false,
  hideLabel = false,
  persistEnabled = false,
  isPersisting = false,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  withdrawalRate: number;
  onWithdrawalRateChange: (value: number) => void;
  targetYears: number;
  onTargetYearsChange: (value: number) => void;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  equityTotal: number;
  ifixTotal: number;
  monthlySavings?: number;
  defaultMonthlySavings?: number;
  onMonthlySavingsChange?: (value: number) => void;
  onMonthlySavingsReset?: () => void;
  isMonthlySavingsOverridden?: boolean;
  simulatedExpenses?: number | null;
  onSimulatedExpensesChange?: (value: number | null) => void;
  excludeIfixFromSim?: boolean;
  onExcludeIfixFromSimChange?: (value: boolean) => void;
  onProgressClick?: () => void;
  compact?: boolean;
  hideLabel?: boolean;
  persistEnabled?: boolean;
  isPersisting?: boolean;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  const [localSimulatedExpenses, setLocalSimulatedExpenses] = useState<
    number | null
  >(null);
  const simulatedExpenses =
    simulatedExpensesProp !== undefined
      ? simulatedExpensesProp
      : localSimulatedExpenses;
  const setSimulatedExpenses = (value: number | null) => {
    if (onSimulatedExpensesChange) onSimulatedExpensesChange(value);
    else setLocalSimulatedExpenses(value);
  };
  const effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses;
  const showOtimista = visibleScenarios.includes("otimista");
  const showMediana = visibleScenarios.includes("mediana");
  const showPessimista = visibleScenarios.includes("pessimista");

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;

  // "Excluir FII" toggle. See ConstantDollarIndicator for the same flag and
  // the buildAgeInBondsWeightsAt comment above for how it propagates through
  // the glide path (per-year `weights.ifix = 0` without redistributing to
  // equity, weights sum to <1, missing fraction earns 0% real).
  const [localExcludeIfixFromSim, setLocalExcludeIfixFromSim] = useState(false);
  const excludeIfixFromSim =
    excludeIfixFromSimProp ?? localExcludeIfixFromSim;
  const setExcludeIfixFromSim = (value: boolean) => {
    if (onExcludeIfixFromSimChange) onExcludeIfixFromSimChange(value);
    else setLocalExcludeIfixFromSim(value);
  };

  const annualExpenses = effectiveMonthlyExpenses * 12;
  const annualWithdrawal = effectivePatrimony * (withdrawalRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;

  const investmentTotal = fixedIncomeTotal + variableIncomeTotal;
  const currentBondPct = investmentTotal > 0 ? (fixedIncomeTotal / investmentTotal) * 100 : 0;
  const targetBondPct = currentAge !== null ? Math.min(currentAge, 100) : 0;
  const isOnTarget = Math.abs(currentBondPct - targetBondPct) <= 5;
  const rebalanceAmount =
    investmentTotal > 0
      ? (targetBondPct / 100) * investmentTotal - fixedIncomeTotal
      : 0;

  // Lifestyle bootstrap (post-FIRE): "starting from today's patrimony, can I
  // sustain my actual expenses for `targetYears`?" Anchored at currentAge
  // because a post-FIRE user is retiring *now* — that anchor is the right one
  // for the post-FIRE drawdown chart and depletion labels. Pre-FIRE this is
  // hypothetical and only the depletion labels read from it.
  const lifestyleWeightsAt: WeightsAtFn = useMemo(
    () =>
      buildAgeInBondsWeightsAt(
        currentAge ?? 0,
        equityTotal,
        ifixTotal,
        excludeIfixFromSim,
      ),
    [currentAge, equityTotal, ifixTotal, excludeIfixFromSim],
  );

  const bootstrap = useMemo(
    () =>
      runBootstrapWithVaryingWeights(
        effectivePatrimony,
        annualExpenses,
        targetYears,
        lifestyleWeightsAt,
      ),
    [effectivePatrimony, annualExpenses, targetYears, lifestyleWeightsAt],
  );

  // Accumulation uses *current* static allocation (the user is still working,
  // hasn't started rebalancing toward bonds). Glide path kicks in only at
  // retirement — the solver and post-FIRE bootstrap handle that.
  const annualSavings = Math.max(0, monthlySavings) * 12;
  const rawAccumulationWeights = useMemo(
    () => computeWeights(equityTotal, ifixTotal, fixedIncomeTotal),
    [equityTotal, ifixTotal, fixedIncomeTotal],
  );
  // Same "treat IFIX as cash 0%" override applied to the static accumulation
  // weights. Sum drops to 1 - rawIfixWeight; the IFIX fraction earns 0% real
  // during accumulation just like during the glide.
  const accumulationWeights = useMemo<AllocationWeights>(
    () =>
      excludeIfixFromSim
        ? { ...rawAccumulationWeights, ifix: 0 }
        : rawAccumulationWeights,
    [rawAccumulationWeights, excludeIfixFromSim],
  );

  // Fixed-point solver: produces one coherent {fireTarget, targetMultiplier,
  // horizonFactor, safeRate, baselineSafeRate, rateBootstrap, accumulation,
  // drawdownAtTarget, anchorAge, status} object whose glide-path anchor is
  // the projected retirement age (not currentAge). See the solver comment
  // above and the fire-bootstrap-methodology skill for rationale.
  //
  // When `currentAge` is null (no DOB on profile), the component returns the
  // "configure sua data de nascimento" placeholder a few lines below, so the
  // result would be discarded anyway. Short-circuit with an empty state to
  // skip ~5 expensive bootstrap calls per render in that branch.
  const solverState = useMemo<AgeInBondsFireState>(() => {
    if (currentAge === null) return EMPTY_AGE_IN_BONDS_FIRE_STATE;
    return solveAgeInBondsFireState({
      currentAge,
      equityTotal,
      ifixTotal,
      effectivePatrimony,
      annualExpenses,
      annualSavings,
      withdrawalRate,
      targetYears,
      accumulationWeights,
      excludeIfix: excludeIfixFromSim,
    });
  }, [
    currentAge,
    equityTotal,
    ifixTotal,
    effectivePatrimony,
    annualExpenses,
    annualSavings,
    withdrawalRate,
    targetYears,
    accumulationWeights,
    excludeIfixFromSim,
  ]);
  const {
    fireTarget,
    targetMultiplier,
    safeRate,
    rateBootstrap,
    accumulation,
    drawdownAtTarget,
  } = solverState;

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  if (!dateOfBirth || currentAge === null) {
    return (
      <Stack
        sx={{
          height: 24,
          borderRadius: "10px",
          backgroundColor: getColor(Colors.neutral600),
          justifyContent: "center",
          px: 1.5,
        }}
      >
        <Text
          color={Colors.neutral300}
          size={FontSizes.SEMI_SMALL}
          weight={FontWeights.MEDIUM}
        >
          Retirada constante (Idade em RF) — configure sua data de nascimento no perfil
        </Text>
      </Stack>
    );
  }

  const monthlyWithdrawalFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesFormatted = hideValues ? "***" : formatCurrency(effectiveMonthlyExpenses);
  const isAggressiveRate = rateBootstrap.successRate < 0.85;
  const tooltipTitle =
    `Probabilidade histórica do patrimônio sustentar suas despesas (${monthlyExpensesFormatted}/mês, ` +
    `ajustadas por inflação) por ${targetYears} anos com alocação Idade em RF (RF% = idade). ` +
    `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% (90% sucesso). ` +
    `Meta de FIRE pela regra ${withdrawalRate}%: ${targetMultiplier.toFixed(1)}× despesas anuais.`;

  const lifestyleSuccess = bootstrap.successRate;
  const fireProgress = fireTarget > 0 ? (effectivePatrimony / fireTarget) * 100 : 0;
  const medianDepletionLabel =
    bootstrap.medianDepletionYear !== null
      ? `${bootstrap.medianDepletionYear} anos`
      : `${targetYears}+ anos`;
  const p10DepletionLabel =
    bootstrap.p10DepletionYear !== null
      ? `${bootstrap.p10DepletionYear} anos`
      : `${targetYears}+ anos`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div
          role={onProgressClick ? "link" : undefined}
          tabIndex={onProgressClick ? 0 : undefined}
          onClick={onProgressClick}
          onKeyDown={(event) => {
            if (!onProgressClick) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onProgressClick();
            }
          }}
          style={{
            position: "relative",
            cursor: onProgressClick ? "pointer" : undefined,
          }}
        >
          <ProgressBar
            variant="determinate"
            value={Math.min(fireProgress, 100)}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            {!hideLabel && (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.MEDIUM}
                size={FontSizes.SEMI_SMALL}
              >
                Retirada constante (Idade em RF)
              </Text>
            )}
            {hideValues ? (
              <Skeleton
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "60px",
                }}
                animation={false}
              />
            ) : (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.SEMI_BOLD}
                size={FontSizes.SEMI_SMALL}
              >
                {fireProgress.toFixed(0)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {(() => {
            const compactTargetTail =
              fireProgress < 100 &&
              annualSavings > 0 &&
              accumulation.medianYearsToTarget !== null
                ? ` (~${accumulation.medianYearsToTarget}a no ritmo atual)`
                : "";
            if (compact) {
              return `Meta: ${hideValues ? "***" : formatCurrency(fireTarget)}${compactTargetTail}`;
            }
            const gap = monthlyWithdrawal - effectiveMonthlyExpenses;
            const gapFormatted = hideValues ? "***" : formatCurrency(Math.abs(gap));
            const sign = gap >= 0 ? "sobram" : "faltam";
            const accumulationTail =
              fireProgress < 100 &&
              annualSavings > 0 &&
              accumulation.medianYearsToTarget !== null
                ? ` em ~${accumulation.medianYearsToTarget}a no ritmo atual`
                : "";
            const targetSegment =
              annualExpenses > 0
                ? fireProgress < 100
                  ? ` · Meta: ${hideValues ? "***" : formatCurrency(fireTarget)} (faltam ${hideValues ? "***" : formatCurrency(fireTarget - effectivePatrimony)}${accumulationTail})`
                  : ` · Meta atingida: ${hideValues ? "***" : formatCurrency(fireTarget)}`
                : "";
            return `Retirada: ${monthlyWithdrawalFormatted}/mês · Despesas: ${monthlyExpensesFormatted}/mês (${sign}: ${gapFormatted}/mês${targetSegment})`;
          })()}
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          <span style={{ color: getColor(isOnTarget ? Colors.brand : Colors.danger200) }}>
            RF: {currentBondPct.toFixed(0)}% (meta {targetBondPct}%)
          </span>
          {Math.abs(rebalanceAmount) > 0 && !hideValues && (
            <span>
              {" · "}
              {rebalanceAmount > 0
                ? `Mover ${formatCurrency(rebalanceAmount)} para RF`
                : `Mover ${formatCurrency(Math.abs(rebalanceAmount))} para RV`}
            </span>
          )}
        </Text>
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <PersistedSlider
            value={withdrawalRate}
            onChange={onWithdrawalRateChange}
            renderLabel={(v) => (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                Taxa: {v}% a.a.
              </Text>
            )}
            enabled={persistEnabled}
            isPersisting={isPersisting}
            min={2}
            max={6}
            step={0.5}
            marks
          />
          <PersistedSlider
            value={targetYears}
            onChange={onTargetYearsChange}
            renderLabel={(v) => (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                Horizonte: {v} anos
              </Text>
            )}
            enabled={persistEnabled}
            isPersisting={isPersisting}
            min={20}
            max={80}
            step={5}
            marks
          />
          <PatrimonySimulator
            value={effectivePatrimony}
            onChange={setSimulatedPatrimony}
            onReset={() => setSimulatedPatrimony(null)}
            patrimonyTotal={patrimonyTotal}
            showReset={simulatedPatrimony !== null}
            isPersisting={isPersisting}
          />
          <ExpenseSimulator
            value={effectiveMonthlyExpenses}
            onChange={setSimulatedExpenses}
            onReset={() => setSimulatedExpenses(null)}
            avgMonthlyExpenses={avgExpenses}
            showReset={simulatedExpenses !== null}
            enabled={persistEnabled}
            isPersisting={isPersisting}
          />
        </Stack>
      )}
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={isAggressiveRate ? Colors.danger200 : Colors.neutral400}
            weight={isAggressiveRate ? FontWeights.MEDIUM : undefined}
          >
            {isAggressiveRate
              ? `⚠ Taxa de ${withdrawalRate}% tem apenas ${(rateBootstrap.successRate * 100).toFixed(0)}% de sucesso histórico em ${targetYears} anos. Limite seguro: ${safeRate.toFixed(2)}% (90% sucesso).`
              : `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% a.a. (90% sucesso histórico).`}
          </Text>
        </Stack>
      )}
      {!compact &&
        // Gate on the *raw* glide (excludeIfix=false) so the checkbox stays
        // visible after the user toggles "Excluir FII" — otherwise the toggle
        // would hide itself and the user couldn't toggle back.
        isIfixRestrictedSampleForVaryingWeights(
          buildAgeInBondsWeightsAt(
            solverState.anchorAge,
            equityTotal,
            ifixTotal,
            false,
          ),
          targetYears,
        ) && (
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              <em>
                {excludeIfixFromSim
                  ? "FII excluído da simulação (modelado como caixa, 0% real). Amostra mensal: 1995–2025 (372 meses)."
                  : "Amostra histórica mensal: 2011–2025 (180 meses) — sua exposição a FII restringe a janela. Não compare diretamente com SWRs Trinity baseados em séries longas (US 1926+)."}
              </em>
            </Text>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={excludeIfixFromSim}
                  onChange={(e) => setExcludeIfixFromSim(e.target.checked)}
                />
              }
              label={
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Excluir FII da simulação
                </Text>
              }
            />
          </Stack>
        )}
      {!compact && annualExpenses > 0 && fireProgress >= 100 && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Sustentabilidade em {targetYears}a: {(lifestyleSuccess * 100).toFixed(0)}% · Sucesso da taxa {withdrawalRate}%: {(rateBootstrap.successRate * 100).toFixed(0)}% · Depleção p10: {p10DepletionLabel} · Mediana: {medianDepletionLabel}
          </Text>
        </Stack>
      )}
      {!compact && annualExpenses > 0 && fireProgress < 100 && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          {annualSavings <= 0 ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              Receitas ≤ despesas no momento — comece a poupar para projetar o
              tempo até a meta.
            </Text>
          ) : accumulation.medianYearsToTarget === null ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              No ritmo de {hideValues ? "***" : formatCurrency(monthlySavings)}/mês,
              improvável atingir a meta em 60 anos (sucesso histórico{" "}
              {(accumulation.successRate * 100).toFixed(0)}%).
            </Text>
          ) : (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              No ritmo de {hideValues ? "***" : formatCurrency(monthlySavings)}/mês:
              mediana <strong>{accumulation.medianYearsToTarget}a</strong>{" "}
              · otimista (p10) {accumulation.p10YearsToTarget}a · pessimista
              (p90) {accumulation.p90YearsToTarget}a · sucesso{" "}
              {(accumulation.successRate * 100).toFixed(0)}% em 60a
            </Text>
          )}
        </Stack>
      )}
      {!compact && fireProgress < 100 && accumulation.gapBands.length > 1 && (() => {
        const toggleScenario = (
          scenario: "otimista" | "mediana" | "pessimista",
          checked: boolean,
        ) => {
          setVisibleScenarios((prev) =>
            checked
              ? [...prev, scenario]
              : prev.filter((v) => v !== scenario),
          );
        };
        const onlyOne = visibleScenarios.length === 1;
        return (
          <Stack direction="row" justifyContent="flex-end">
            <FormControlLabel
              control={
                <Checkbox
                  checked={showOtimista}
                  onChange={(_, checked) => toggleScenario("otimista", checked)}
                  disabled={onlyOne && showOtimista}
                />
              }
              label="Otimista"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showMediana}
                  onChange={(_, checked) => toggleScenario("mediana", checked)}
                  disabled={onlyOne && showMediana}
                />
              }
              label="Mediana"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showPessimista}
                  onChange={(_, checked) =>
                    toggleScenario("pessimista", checked)
                  }
                  disabled={onlyOne && showPessimista}
                />
              }
              label="Pessimista"
            />
          </Stack>
        );
      })()}
      {!compact && fireProgress < 100 && accumulation.gapBands.length > 1 && (() => {
        const accTrimEnd =
          accumulation.p90YearsToTarget !== null
            ? Math.min(
                accumulation.gapBands.length,
                accumulation.p90YearsToTarget + 3,
              )
            : accumulation.gapBands.length;
        const useAgeAxis = currentAge !== null;
        const accData = accumulation.gapBands.slice(0, accTrimEnd).map((b) => ({
          ...b,
          age: useAgeAxis ? (currentAge as number) + b.year : b.year,
        }));
        const ageLabel = (years: number) =>
          useAgeAxis
            ? `aos ${(currentAge as number) + years}`
            : `em ${years} anos`;
        const refX = (years: number) =>
          useAgeAxis ? (currentAge as number) + years : years;
        return (
          <>
            <Text
              size={FontSizes.EXTRA_SMALL}
              weight={FontWeights.MEDIUM}
              color={Colors.neutral200}
            >
              Acumulação · quantos reais ainda preciso acumular para atingir minha meta de FIRE em cada idade
            </Text>
            {onMonthlySavingsChange && onMonthlySavingsReset && (
              <SavingsSimulator
                value={Math.max(0, monthlySavings)}
                onChange={onMonthlySavingsChange}
                onReset={onMonthlySavingsReset}
                avgMonthlySavings={Math.max(0, defaultMonthlySavings)}
                showReset={isMonthlySavingsOverridden}
                isPersisting={isPersisting}
              />
            )}
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={accData}
                margin={{ top: 50, right: 5, left: 5, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="5" vertical={false} />
                <XAxis
                  dataKey={useAgeAxis ? "age" : "year"}
                  stroke={getColor(Colors.neutral0)}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis
                  stroke={getColor(Colors.brand400)}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={numberTickFormatter}
                  tickCount={hideValues ? 0 : undefined}
                />
                <RechartsTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideValues={hideValues}
                      showOtimista={showOtimista}
                      showMediana={showMediana}
                      showPessimista={showPessimista}
                      invertLabels
                    />
                  }
                />
                {showOtimista && accumulation.p10YearsToTarget !== null && (
                  <ReferenceLine
                    x={refX(accumulation.p10YearsToTarget)}
                    stroke={getColor(Colors.brand)}
                    strokeDasharray="3 3"
                    label={{
                      value: `otimista · aposenta ${ageLabel(accumulation.p10YearsToTarget)}`,
                      position: "top",
                      dy: -34,
                      fill: getColor(Colors.brand),
                      fontSize: 12,
                    }}
                  />
                )}
                {showMediana && accumulation.medianYearsToTarget !== null && (
                  <ReferenceLine
                    x={refX(accumulation.medianYearsToTarget)}
                    stroke={getColor(Colors.brand)}
                    strokeDasharray="3 3"
                    label={{
                      value: `mediana · aposenta ${ageLabel(accumulation.medianYearsToTarget)}`,
                      position: "top",
                      dy: -18,
                      fill: getColor(Colors.brand),
                      fontSize: 12,
                    }}
                  />
                )}
                {showPessimista && accumulation.p90YearsToTarget !== null && (
                  <ReferenceLine
                    x={refX(accumulation.p90YearsToTarget)}
                    stroke={getColor(Colors.danger200)}
                    strokeDasharray="3 3"
                    label={{
                      value: `pessimista · aposenta ${ageLabel(accumulation.p90YearsToTarget)}`,
                      position: "top",
                      dy: -2,
                      fill: getColor(Colors.danger200),
                      fontSize: 12,
                    }}
                  />
                )}
                {showOtimista && (
                  <Line
                    type="monotone"
                    dataKey="p10"
                    stroke={getColor(Colors.brand)}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    name="p10 (otimista)"
                  />
                )}
                {showMediana && (
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke={getColor(Colors.brand200)}
                    strokeWidth={2}
                    dot={false}
                    name="Mediana"
                  />
                )}
                {showPessimista && (
                  <Line
                    type="monotone"
                    dataKey="p90"
                    stroke={getColor(Colors.danger200)}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    name="p90 (pessimista)"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {drawdownAtTarget !== null && (
              <>
                <Text
                  size={FontSizes.EXTRA_SMALL}
                  weight={FontWeights.MEDIUM}
                  color={Colors.neutral200}
                >
                  Aposentadoria · trajetória do patrimônio depois de atingir a meta
                </Text>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Sucesso em {targetYears}a:{" "}
                  <strong>{(drawdownAtTarget.successRate * 100).toFixed(0)}%</strong>
                  {" · "}
                  Depleção mediana:{" "}
                  <strong>
                    {drawdownAtTarget.medianDepletionYear !== null
                      ? `${drawdownAtTarget.medianDepletionYear} anos`
                      : "nunca"}
                  </strong>
                  {" · "}
                  Depleção pessimista (p10):{" "}
                  <strong>
                    {drawdownAtTarget.p10DepletionYear !== null
                      ? `${drawdownAtTarget.p10DepletionYear} anos`
                      : "nunca"}
                  </strong>
                </Text>
                {(() => {
                  // The solver returns the same anchor age it used to compute
                  // drawdownAtTarget — read it directly so the preview's age
                  // axis is guaranteed to match the glide path the bootstrap
                  // actually traced.
                  const retirementAge = solverState.anchorAge;
                  const drawdownData = drawdownAtTarget.bands.map((b, i) => {
                    const wb =
                      i === 0 ? null : drawdownAtTarget.withdrawalBands[i - 1];
                    return {
                      age: retirementAge + b.year,
                      year: b.year,
                      balanceP10: b.p10,
                      balanceP50: b.p50,
                      balanceP90: b.p90,
                      withdrawalP10: wb?.p10 ?? null,
                      withdrawalP50: wb?.p50 ?? null,
                      withdrawalP90: wb?.p90 ?? null,
                    };
                  });
                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart
                        data={drawdownData}
                        margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="5" vertical={false} />
                        <XAxis
                          dataKey="age"
                          stroke={getColor(Colors.neutral0)}
                          tickLine={false}
                          tickFormatter={(v) => `${v}`}
                        />
                        <YAxis
                          stroke={getColor(Colors.brand400)}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={numberTickFormatter}
                          tickCount={hideValues ? 0 : undefined}
                        />
                        <RechartsTooltip
                          cursor={false}
                          content={
                            <DrawdownTooltipContent
                              hideValues={hideValues}
                              showOtimista={showOtimista}
                              showMediana={showMediana}
                              showPessimista={showPessimista}
                              xLabel="Idade"
                            />
                          }
                        />
                        {showPessimista && (
                          <Line
                            type="monotone"
                            dataKey="balanceP10"
                            stroke={getColor(Colors.danger200)}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                            name="p10 (pessimista)"
                          />
                        )}
                        {showMediana && (
                          <Line
                            type="monotone"
                            dataKey="balanceP50"
                            stroke={getColor(Colors.brand200)}
                            strokeWidth={2}
                            dot={false}
                            name="Mediana"
                          />
                        )}
                        {showOtimista && (
                          <Line
                            type="monotone"
                            dataKey="balanceP90"
                            stroke={getColor(Colors.brand)}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                            name="p90 (otimista)"
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })()}
              </>
            )}
          </>
        );
      })()}
      {!compact && fireProgress >= 100 && bootstrap.bands.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={bootstrap.bands}
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="5" vertical={false} />
            <XAxis
              dataKey="year"
              stroke={getColor(Colors.neutral0)}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              stroke={getColor(Colors.brand400)}
              tickLine={false}
              axisLine={false}
              tickFormatter={numberTickFormatter}
              tickCount={hideValues ? 0 : undefined}
            />
            <RechartsTooltip
              cursor={false}
              content={<ChartTooltipContent hideValues={hideValues} />}
            />
            <Line
              type="monotone"
              dataKey="p10"
              stroke={getColor(Colors.danger200)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="p10"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke={getColor(Colors.brand200)}
              strokeWidth={2}
              dot={false}
              name="Mediana"
            />
            <Line
              type="monotone"
              dataKey="p90"
              stroke={getColor(Colors.brand)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="p90"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default ConstantDollarAgeInBondsIndicator;

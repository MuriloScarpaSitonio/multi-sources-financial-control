import { useMemo, useState } from "react";

import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
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
import { sliderSx } from "./consts";
import PatrimonySimulator from "./PatrimonySimulator";
import SavingsSimulator from "./SavingsSimulator";
import ExpenseSimulator from "./ExpenseSimulator";
import VPWSimulationResults, {
  type VPWProjectionPoint,
} from "./VPWSimulationResults";
import {
  runBootstrapWithVaryingWithdrawal,
  runAccumulationBootstrapVarying,
  type AccumulationResult as BootstrapAccumulationResult,
  type AllocationWeights,
  type WithdrawalAtFn,
} from "./fireBootstrap";

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

const pmt = (rate: number, nper: number, pv: number = -1, fv: number = 0): number => {
  if (nper <= 0) return 0;
  if (rate === 0) return -pv / nper;
  const rateFactor = Math.pow(1 + rate, nper);
  return (rate * (fv + pv * rateFactor)) / (rateFactor - 1);
};

const computeVPWRate = (
  rvPct: number,
  rfPct: number,
  yearsRemaining: number,
  stockReturn: number,
  bondReturn: number,
): number => {
  if (yearsRemaining <= 0) return 100;
  const realReturn = (rvPct * stockReturn + rfPct * bondReturn) / 100 / 100;
  return -pmt(realReturn, yearsRemaining) * 100;
};

const MAX_ACCUM_YEARS = 80;

type AccumulationPoint = {
  year: number;
  age: number;
  gapP10: number;
  gapP50: number;
  gapP90: number;
};

type AccumulationResult = {
  points: AccumulationPoint[];
  crossoverYearP10: number | null; // best decile (fastest)
  crossoverYearP50: number | null; // median
  crossoverYearP90: number | null; // worst decile (slowest)
  initialGap: number;
  target0: number;
};

const AccumulationTooltipContent = ({
  active,
  payload,
  hideValues,
  showPessimista,
  showMediana,
  showOtimista,
}: {
  active?: boolean;
  payload?: { payload: AccumulationPoint }[];
  hideValues?: boolean;
  showPessimista?: boolean;
  showMediana?: boolean;
  showOtimista?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmt = (v: number) => (hideValues ? "***" : formatCurrency(v));
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
        Idade {data.age} (ano {data.year})
      </p>
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p10): falta {fmt(data.gapP10)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): falta {fmt(data.gapP50)}
        </p>
      )}
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista (p90): falta {fmt(data.gapP90)}
        </p>
      )}
    </Stack>
  );
};

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const VPWIndicator = ({
  equityTotal,
  ifixTotal,
  fixedIncomeTotal,
  avgExpenses,
  avgMonthlySavings,
  isLoading,
  dateOfBirth,
  targetAge,
  onTargetAgeChange,
  stockReturn,
  onStockReturnChange,
  bondReturn,
  onBondReturnChange,
  compact = false,
  hideLabel = false,
}: {
  equityTotal: number;
  ifixTotal: number;
  fixedIncomeTotal: number;
  avgExpenses: number;
  avgMonthlySavings: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetAge: number;
  onTargetAgeChange: (value: number) => void;
  stockReturn: number;
  onStockReturnChange: (value: number) => void;
  bondReturn: number;
  onBondReturnChange: (value: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [overrideStockPct, setOverrideStockPct] = useState<number | null>(null);
  const [simulatedSavings, setSimulatedSavings] = useState<number | null>(null);
  const [simulatedExpenses, setSimulatedExpenses] = useState<number | null>(null);
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  const showOtimista = visibleScenarios.includes("otimista");
  const showMediana = visibleScenarios.includes("mediana");
  const showPessimista = visibleScenarios.includes("pessimista");
  const toggleScenario = (
    scenario: "otimista" | "mediana" | "pessimista",
    checked: boolean,
  ) => {
    setVisibleScenarios((prev) =>
      checked ? [...prev, scenario] : prev.filter((v) => v !== scenario),
    );
  };
  const effectiveSavings = simulatedSavings ?? Math.max(0, avgMonthlySavings);
  const effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses;

  const investmentTotal = equityTotal + ifixTotal + fixedIncomeTotal;
  const variableIncomeTotal = equityTotal + ifixTotal;
  const effectiveInvestment = simulatedPatrimony ?? investmentTotal;
  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;

  const derivedStockPct = investmentTotal > 0 ? (variableIncomeTotal / investmentTotal) * 100 : 60;
  const effectiveStockPct = overrideStockPct ?? derivedStockPct;
  const effectiveBondPct = 100 - effectiveStockPct;

  const stockReturnInert = effectiveStockPct < 0.01;
  const bondReturnInert = effectiveBondPct < 0.01;

  const yearsRemaining = currentAge !== null ? targetAge - currentAge : null;
  const vpwRate = yearsRemaining !== null && yearsRemaining > 0
    ? computeVPWRate(effectiveStockPct, effectiveBondPct, yearsRemaining, stockReturn, bondReturn)
    : 0;

  const annualWithdrawal = effectiveInvestment * (vpwRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;
  const coverage = effectiveMonthlyExpenses > 0 ? (monthlyWithdrawal / effectiveMonthlyExpenses) * 100 : 0;
  const targetPatrimonyToday =
    vpwRate > 0 ? (effectiveMonthlyExpenses * 1200) / vpwRate : 0;
  const allocationLabel = `${effectiveStockPct.toFixed(0)}% RV / ${effectiveBondPct.toFixed(0)}% RF`;

  const accumulation = useMemo<AccumulationResult | null>(() => {
    if (currentAge === null || yearsRemaining === null || yearsRemaining <= 0) {
      return null;
    }

    // Bootstrap weights: same logic as the drawdown chart — preserve the
    // actual equity:ifix ratio inside the RV bucket, fall back to all-equity
    // if the user has no RV today.
    const rvTotal = equityTotal + ifixTotal;
    const equityShareOfRv = rvTotal > 0 ? equityTotal / rvTotal : 1;
    const weights: AllocationWeights = {
      equity: (effectiveStockPct / 100) * equityShareOfRv,
      ifix: (effectiveStockPct / 100) * (1 - equityShareOfRv),
      fixedIncome: effectiveBondPct / 100,
    };

    const targetAt = (k: number): number => {
      const yearsAtRetirement = yearsRemaining - k;
      if (yearsAtRetirement <= 0) return Infinity;
      const rate = computeVPWRate(
        effectiveStockPct,
        effectiveBondPct,
        yearsAtRetirement,
        stockReturn,
        bondReturn,
      );
      return (effectiveMonthlyExpenses * 1200) / rate;
    };

    const cap = Math.min(MAX_ACCUM_YEARS, yearsRemaining - 1);
    // Retirement timing starts from the real current investment total. The
    // patrimony simulator is a what-if input for the retire-today VPW scenario,
    // and must not move the "Quando posso me aposentar com VPW?" forecast.
    const result: BootstrapAccumulationResult = runAccumulationBootstrapVarying({
      startingBalance: investmentTotal,
      annualContribution: effectiveSavings * 12,
      targetAt,
      weights,
      maxYears: cap,
      numTrials: 1500,
    });

    const target0 = targetAt(0);
    const initialGap = Math.max(0, target0 - investmentTotal);

    // Trim the chart to a few years past p90 so the post-crossover flat zeros
    // don't dominate the X-range.
    const trimEnd =
      result.p90YearsToTarget !== null
        ? Math.min(result.gapBands.length, result.p90YearsToTarget + 3)
        : result.gapBands.length;

    const points: AccumulationPoint[] = result.gapBands
      .slice(0, trimEnd)
      .map((band) => ({
        year: band.year,
        age: currentAge + band.year,
        gapP10: band.p10,
        gapP50: band.p50,
        gapP90: band.p90,
      }));

    return {
      points,
      crossoverYearP10: result.p10YearsToTarget,
      crossoverYearP50: result.medianYearsToTarget,
      crossoverYearP90: result.p90YearsToTarget,
      initialGap,
      target0,
    };
  }, [
    investmentTotal,
    effectiveSavings,
    effectiveMonthlyExpenses,
    effectiveStockPct,
    effectiveBondPct,
    stockReturn,
    bondReturn,
    yearsRemaining,
    currentAge,
    equityTotal,
    ifixTotal,
  ]);

  // Scenario bootstrap: start VPW today with the patrimony used in the current
  // scenario and recalculate the withdrawal each year until the target age.
  const projection = useMemo<VPWProjectionPoint[]>(() => {
    if (
      currentAge === null ||
      yearsRemaining === null ||
      yearsRemaining <= 0
    ) {
      return [];
    }

    // Bootstrap weights: rebalance to the user's effective allocation, preserving
    // the actual equity:ifix split inside the RV bucket. If the user has no RV
    // at all, default to 100% equity within RV — equity has the longer, broader
    // historical series, so it's the more conservative choice when the user has
    // expressed no equity-vs-IFIX preference. RF maps directly to fixedIncome.
    const rvTotal = equityTotal + ifixTotal;
    const equityShareOfRv = rvTotal > 0 ? equityTotal / rvTotal : 1;
    const weights: AllocationWeights = {
      equity: (effectiveStockPct / 100) * equityShareOfRv,
      ifix: (effectiveStockPct / 100) * (1 - equityShareOfRv),
      fixedIncome: effectiveBondPct / 100,
    };

    const withdrawalAt: WithdrawalAtFn = (yearIndex, balance) => {
      const yearsLeft = yearsRemaining - yearIndex;
      if (yearsLeft <= 0) return balance; // final-year sweep
      const rate = computeVPWRate(
        effectiveStockPct,
        effectiveBondPct,
        yearsLeft,
        stockReturn,
        bondReturn,
      );
      return balance * (rate / 100);
    };

    const result = runBootstrapWithVaryingWithdrawal(
      effectiveInvestment,
      weights,
      yearsRemaining,
      withdrawalAt,
      1500,
    );

    const chartPoints: VPWProjectionPoint[] = result.withdrawalBands.map((wBand, i) => {
      const balanceBand = result.balanceBands[i];
      return {
        age: currentAge + i,
        withdrawalP10: wBand.p10 / 12,
        withdrawalP50: wBand.p50 / 12,
        withdrawalP90: wBand.p90 / 12,
        balanceP10: balanceBand.p10,
        balanceP50: balanceBand.p50,
        balanceP90: balanceBand.p90,
        expenses: effectiveMonthlyExpenses,
      };
    });

    // Append the post-sweep point at target age so the balance trace visibly
    // reaches zero (without it, the chart's right edge shows the start-of-year
    // balance of the last simulated year, not the depleted endpoint).
    const finalBalance = result.balanceBands[yearsRemaining];
    if (finalBalance) {
      chartPoints.push({
        age: currentAge + yearsRemaining,
        withdrawalP10: 0,
        withdrawalP50: 0,
        withdrawalP90: 0,
        balanceP10: finalBalance.p10,
        balanceP50: finalBalance.p50,
        balanceP90: finalBalance.p90,
        expenses: effectiveMonthlyExpenses,
      });
    }

    return chartPoints;
  }, [
    effectiveInvestment,
    effectiveMonthlyExpenses,
    currentAge,
    yearsRemaining,
    effectiveStockPct,
    effectiveBondPct,
    stockReturn,
    bondReturn,
    equityTotal,
    ifixTotal,
  ]);

  const accumulationLabels = useMemo(() => {
    if (!accumulation || currentAge === null) return null;
    const { crossoverYearP50, initialGap } = accumulation;

    if (initialGap === 0) {
      return {
        gapText: "Já cobre o alvo VPW",
        timeText: `Pode aposentar hoje aos ${currentAge} anos`,
        gapIsBad: false,
        timeIsBad: false,
      };
    }

    const gapText = `Falta juntar ${
      hideValues ? "***" : formatCurrency(initialGap)
    } para começar VPW hoje`;

    if (crossoverYearP50 !== null) {
      return {
        gapText,
        timeText: `Em ${crossoverYearP50} ${
          crossoverYearP50 === 1 ? "ano" : "anos"
        } no seu ritmo (aposenta aos ${currentAge + crossoverYearP50})`,
        gapIsBad: true,
        timeIsBad: false,
      };
    }

    return {
      gapText,
      timeText: `Mais de ${MAX_ACCUM_YEARS} anos no seu ritmo — aumente os aportes ou o retorno`,
      gapIsBad: true,
      timeIsBad: true,
    };
  }, [accumulation, currentAge, hideValues]);

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
          VPW — configure sua data de nascimento no perfil
        </Text>
      </Stack>
    );
  }

  if (yearsRemaining === null || yearsRemaining <= 0) {
    return (
      <Stack
        sx={{
          height: 24,
          borderRadius: "10px",
          backgroundColor: getColor(Colors.danger200),
          justifyContent: "center",
          px: 1.5,
        }}
      >
        <Text
          color={Colors.neutral0}
          size={FontSizes.SEMI_SMALL}
          weight={FontWeights.MEDIUM}
        >
          VPW — idade alvo deve ser maior que sua idade atual ({currentAge})
        </Text>
      </Stack>
    );
  }

  const monthlyFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const isSimulating = simulatedPatrimony !== null || overrideStockPct !== null;
  const baseLabel = isSimulating ? "Saque simulado" : "Saque atual";
  const tooltipTitle =
    `VPW: Variable Percentage Withdrawal, em português retirada percentual variável. ` +
    `100% = saque cobre despesas hoje. O saque cresce conforme você ` +
    `envelhece — veja o gráfico para a trajetória completa. ` +
    `Idade: ${currentAge}, meta: ${targetAge}, anos restantes: ${yearsRemaining}. ` +
    `Alocação efetiva: ${effectiveStockPct.toFixed(0)}% RV / ${effectiveBondPct.toFixed(0)}% RF` +
    `${overrideStockPct !== null ? " (override)" : ""}. ` +
    `${baseLabel}: ${vpwRate.toFixed(1)}% a.a. (${monthlyFormatted}/mês).`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar
            variant="determinate"
            value={Math.min(coverage, 100)}
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
                VPW
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
                Cobertura: {coverage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Saque: {vpwRate.toFixed(1)}% a.a. · {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
        </Text>
        {!compact && accumulationLabels && (
          <>
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={accumulationLabels.gapIsBad ? Colors.danger200 : Colors.brand}
              weight={FontWeights.MEDIUM}
            >
              {accumulationLabels.gapText}
            </Text>
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={accumulationLabels.timeIsBad ? Colors.danger200 : Colors.neutral200}
              weight={FontWeights.MEDIUM}
            >
              {accumulationLabels.timeText}
            </Text>
          </>
        )}
      </Stack>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Idade alvo: {targetAge}
        </Text>
        <Slider
          value={targetAge}
          onChange={(_, value) => onTargetAgeChange(value as number)}
          min={70}
          max={105}
          step={1}
          marks={Array.from({ length: 36 }, (_, i) => ({ value: 70 + i, label: "" }))}
          size="medium"
          sx={sliderSx}
        />
        {!compact && (
          <>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              {overrideStockPct !== null && <span style={{ fontStyle: "italic" }}>(simulado) </span>}
              Alocação RV: {effectiveStockPct.toFixed(0)}% / RF: {effectiveBondPct.toFixed(0)}%
            </Text>
            <Slider
              value={effectiveStockPct}
              onChange={(_, value) => setOverrideStockPct(value as number)}
              min={0}
              max={100}
              step={5}
              size="medium"
              sx={sliderSx}
            />
            {overrideStockPct !== null && (
              <Button
                variant="brand-text"
                size="small"
                onClick={() => setOverrideStockPct(null)}
              >
                Resetar
              </Button>
            )}
            <Tooltip
              title={stockReturnInert ? "Sem efeito: alocação RV é 0%" : ""}
              arrow
              placement="top"
            >
              <Stack direction="row" alignItems="center" gap={1} sx={{ opacity: stockReturnInert ? 0.4 : 1 }}>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Retorno RV: {stockReturn}%
                </Text>
                <Slider
                  value={stockReturn}
                  onChange={(_, value) => onStockReturnChange(value as number)}
                  min={3}
                  max={15}
                  step={0.5}
                  marks={Array.from({ length: 25 }, (_, i) => ({ value: 3 + i * 0.5, label: "" }))}
                  size="medium"
                  sx={sliderSx}
                  disabled={stockReturnInert}
                />
              </Stack>
            </Tooltip>
            <Tooltip
              title={bondReturnInert ? "Sem efeito: alocação RF é 0%" : ""}
              arrow
              placement="top"
            >
              <Stack direction="row" alignItems="center" gap={1} sx={{ opacity: bondReturnInert ? 0.4 : 1 }}>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Retorno RF: {bondReturn}%
                </Text>
                <Slider
                  value={bondReturn}
                  onChange={(_, value) => onBondReturnChange(value as number)}
                  min={1}
                  max={8}
                  step={0.5}
                  marks={Array.from({ length: 15 }, (_, i) => ({ value: 1 + i * 0.5, label: "" }))}
                  size="medium"
                  sx={sliderSx}
                  disabled={bondReturnInert}
                />
              </Stack>
            </Tooltip>
          </>
        )}
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <PatrimonySimulator
            value={effectiveInvestment}
            onChange={setSimulatedPatrimony}
            onReset={() => setSimulatedPatrimony(null)}
            patrimonyTotal={investmentTotal}
            showReset={simulatedPatrimony !== null}
          />
          <ExpenseSimulator
            value={effectiveMonthlyExpenses}
            onChange={setSimulatedExpenses}
            onReset={() => setSimulatedExpenses(null)}
            avgMonthlyExpenses={avgExpenses}
            showReset={simulatedExpenses !== null}
          />
        </Stack>
      )}
      {!compact && (
        <VPWSimulationResults
          patrimony={effectiveInvestment}
          monthlyExpenses={effectiveMonthlyExpenses}
          monthlySavings={effectiveSavings}
          monthlyWithdrawal={monthlyWithdrawal}
          vpwRate={vpwRate}
          coverage={coverage}
          targetPatrimony={targetPatrimonyToday}
          yearsRemaining={yearsRemaining}
          targetAge={targetAge}
          allocationLabel={allocationLabel}
          retirementTimingLabel={accumulationLabels?.timeText}
          projection={projection}
          showOtimista={showOtimista}
          showMediana={showMediana}
          showPessimista={showPessimista}
          onScenarioVisibilityChange={toggleScenario}
          hideValues={hideValues}
        />
      )}
      {!compact && accumulation && accumulation.points.length > 1 && (
        <>
          <Stack gap={0.5} sx={{ mt: 2 }}>
            <Text
              size={FontSizes.SMALL}
              weight={FontWeights.SEMI_BOLD}
              color={Colors.neutral200}
            >
              Quando posso me aposentar com VPW?
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              O grafico mostra quanto ainda falta para a retirada VPW cobrir seus
              gastos em cada idade.
            </Text>
          </Stack>
          <SavingsSimulator
            value={effectiveSavings}
            onChange={setSimulatedSavings}
            onReset={() => setSimulatedSavings(null)}
            avgMonthlySavings={Math.max(0, avgMonthlySavings)}
            showReset={simulatedSavings !== null}
          />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={accumulation.points}
              margin={{ top: 50, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey="age"
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                axisLine={false}
                tickFormatter={numberTickFormatter}
                tickCount={hideValues ? 0 : undefined}
              />
              <RechartsTooltip
                cursor={false}
                content={
                  <AccumulationTooltipContent
                    hideValues={hideValues}
                    showPessimista={showPessimista}
                    showMediana={showMediana}
                    showOtimista={showOtimista}
                  />
                }
              />
              {showOtimista && accumulation.crossoverYearP10 !== null && currentAge !== null && (
                <ReferenceLine
                  x={currentAge + accumulation.crossoverYearP10}
                  stroke={getColor(Colors.brand)}
                  strokeDasharray="3 3"
                  label={{
                    value: `otimista · aposenta aos ${currentAge + accumulation.crossoverYearP10}`,
                    position: "top",
                    dy: -34,
                    fill: getColor(Colors.brand),
                    fontSize: 12,
                  }}
                />
              )}
              {showMediana && accumulation.crossoverYearP50 !== null && currentAge !== null && (
                <ReferenceLine
                  x={currentAge + accumulation.crossoverYearP50}
                  stroke={getColor(Colors.brand200)}
                  strokeDasharray="3 3"
                  label={{
                    value: `mediana · aposenta aos ${currentAge + accumulation.crossoverYearP50}`,
                    position: "top",
                    dy: -18,
                    fill: getColor(Colors.brand200),
                    fontSize: 12,
                  }}
                />
              )}
              {showPessimista && accumulation.crossoverYearP90 !== null && currentAge !== null && (
                <ReferenceLine
                  x={currentAge + accumulation.crossoverYearP90}
                  stroke={getColor(Colors.danger200)}
                  strokeDasharray="3 3"
                  label={{
                    value: `pessimista · aposenta aos ${currentAge + accumulation.crossoverYearP90}`,
                    position: "top",
                    dy: -2,
                    fill: getColor(Colors.danger200),
                    fontSize: 12,
                  }}
                />
              )}
              {showOtimista && (
                <Line
                  type="monotone" dataKey="gapP10"
                  stroke={getColor(Colors.brand)} strokeWidth={1.5} strokeDasharray="4 3"
                  dot={false} name="p10 (otimista)"
                />
              )}
              {showMediana && (
                <Line
                  type="monotone" dataKey="gapP50"
                  stroke={getColor(Colors.brand200)} strokeWidth={2}
                  dot={false} name="Mediana"
                />
              )}
              {showPessimista && (
                <Line
                  type="monotone" dataKey="gapP90"
                  stroke={getColor(Colors.danger200)} strokeWidth={1.5} strokeDasharray="4 3"
                  dot={false} name="p90 (pessimista)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </Stack>
  );
};

export default VPWIndicator;

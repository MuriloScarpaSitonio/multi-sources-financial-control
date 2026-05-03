import { useMemo, useState } from "react";

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
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
import { sliderSx } from "./consts";
import ExpenseSimulator from "./ExpenseSimulator";
import PatrimonySimulator from "./PatrimonySimulator";
import SavingsSimulator from "./SavingsSimulator";
import {
  computeWeights,
  findSafeWithdrawalRate,
  runAccumulationBootstrap,
  runBootstrap,
  type BootstrapBand,
} from "./fireBootstrap";

// Bar value is patrimony / fireTarget × 100. ≥100 = FIRE'd.
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

const numberTickFormatter = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
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
}: {
  active?: boolean;
  payload?: { payload: BootstrapBand }[];
  hideValues?: boolean;
  valueFormatter?: (v: number) => string;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
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
          Pessimista (p10): {hideValues ? "***" : valueFormatter(data.p10)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {hideValues ? "***" : valueFormatter(data.p50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p90): {hideValues ? "***" : valueFormatter(data.p90)}
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

const ConstantDollarIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  withdrawalRate,
  onWithdrawalRateChange,
  targetYears,
  onTargetYearsChange,
  equityTotal,
  ifixTotal,
  fixedIncomeTotal,
  monthlySavings = 0,
  defaultMonthlySavings = 0,
  onMonthlySavingsChange,
  onMonthlySavingsReset,
  isMonthlySavingsOverridden = false,
  dateOfBirth = null,
  compact = false,
  hideLabel = false,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  withdrawalRate: number;
  onWithdrawalRateChange: (value: number) => void;
  targetYears: number;
  onTargetYearsChange: (value: number) => void;
  equityTotal: number;
  ifixTotal: number;
  fixedIncomeTotal: number;
  monthlySavings?: number;
  defaultMonthlySavings?: number;
  onMonthlySavingsChange?: (value: number) => void;
  onMonthlySavingsReset?: () => void;
  isMonthlySavingsOverridden?: boolean;
  dateOfBirth?: string | null;
  compact?: boolean;
  hideLabel?: boolean;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  // Which percentile bands + reference lines to render in the accumulation
  // chart. Defaults to all three; user can deselect via the toggle row.
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  // What-if simulator for expenses. Drives the entire indicator (fireTarget,
  // progress bar, accumulation chart, both drawdown charts) so the user can
  // explore "what if my expenses are R$ X" coherently. Reset returns to the
  // user's actual avg.
  const [simulatedExpenses, setSimulatedExpenses] = useState<number | null>(null);
  const effectiveMonthlyExpenses = simulatedExpenses ?? avgExpenses;
  const showOtimista = visibleScenarios.includes("otimista");
  const showMediana = visibleScenarios.includes("mediana");
  const showPessimista = visibleScenarios.includes("pessimista");

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const currentAge = (() => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  })();

  const annualExpenses = effectiveMonthlyExpenses * 12;
  const annualWithdrawal = effectivePatrimony * (withdrawalRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;

  const weights = useMemo(
    () => computeWeights(equityTotal, ifixTotal, fixedIncomeTotal),
    [equityTotal, ifixTotal, fixedIncomeTotal],
  );

  // Bootstrap-derived horizon- and allocation-adjusted SWR. Used as the
  // honesty reference (warning chip + tooltip). The progress bar itself is
  // driven by the bootstrap success rate, not a multiplier formula — see
  // .claude/skills/fire-bootstrap-methodology/SKILL.md.
  const safeRate = useMemo(
    () => findSafeWithdrawalRate(targetYears, weights),
    [targetYears, weights],
  );

  // FIRE_number = expenses × multiplier. Multiplier = (100/userRate) × horizonFactor,
  // where horizonFactor stretches the rule-of-thumb target up for long horizons.
  // horizonFactor = max(1, safeRate(30) / safeRate(horizon)). At 30y baseline
  // factor = 1 (Trinity). At 60y factor ≈ 1.4 (need ~40% more). Clamped at 1
  // from below so short horizons never shrink the target below `expenses ×
  // 100/userRate` — otherwise the bar can read ≥100% while the chosen rate's
  // monthly withdrawal still falls short of expenses.
  // Bar = patrimony / FIRE_number.
  const baselineSafeRate = useMemo(
    () => findSafeWithdrawalRate(30, weights),
    [weights],
  );
  const horizonFactor =
    safeRate > 0 && baselineSafeRate > 0
      ? Math.max(1, baselineSafeRate / safeRate)
      : 1;
  const baseMultiplier = withdrawalRate > 0 ? 100 / withdrawalRate : 0;
  const targetMultiplier = baseMultiplier * horizonFactor;
  const fireTarget = annualExpenses * targetMultiplier;

  // Bar bootstrap: tests sustainability of the user's actual lifestyle
  // (annualExpenses) against their patrimony. Patrimony matters here — more
  // money → smaller effective withdrawal rate → higher success.
  const bootstrap = useMemo(
    () => runBootstrap(effectivePatrimony, annualExpenses, targetYears, weights),
    [effectivePatrimony, annualExpenses, targetYears, weights],
  );

  // Secondary "rate test": is the slider rate historically safe at this
  // horizon and allocation? Scale-invariant (independent of patrimony), so
  // it answers a different question and is shown as a supporting indicator.
  const rateBootstrap = useMemo(
    () => runBootstrap(1_000_000, 1_000_000 * (withdrawalRate / 100), targetYears, weights),
    [withdrawalRate, targetYears, weights],
  );

  // Accumulation forecast: how long until current patrimony + savings
  // crosses `fireTarget`? Returns gap-to-target bands and percentile crossing
  // years. The accumulation chart renders this.
  const annualSavings = Math.max(0, monthlySavings) * 12;
  const accumulation = useMemo(
    () =>
      runAccumulationBootstrap({
        startingBalance: effectivePatrimony,
        annualContribution: annualSavings,
        target: fireTarget,
        weights,
      }),
    [effectivePatrimony, annualSavings, fireTarget, weights],
  );

  // Drawdown forecast: starting from `fireTarget` (i.e., the day you retire),
  // withdraw `annualExpenses` for `targetYears`. Independent of the
  // accumulation simulation — same patrimony level as the FIRE target by
  // construction, regardless of how long it took to get there.
  const drawdownAtTarget = useMemo(
    () => runBootstrap(fireTarget, annualExpenses, targetYears, weights),
    [fireTarget, annualExpenses, targetYears, weights],
  );

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const monthlyWithdrawalFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesFormatted = hideValues ? "***" : formatCurrency(effectiveMonthlyExpenses);
  // Flag the chosen rate as aggressive only when it produces meaningfully
  // worse historical success — not just barely above the 95% safe-rate
  // threshold. The 90% cutoff buffers against rounding noise around the safe
  // rate while still flagging genuinely risky picks.
  const isAggressiveRate = rateBootstrap.successRate < 0.9;
  const tooltipTitle =
    `Probabilidade histórica do patrimônio sustentar suas despesas (${monthlyExpensesFormatted}/mês, ` +
    `ajustadas por inflação) por ${targetYears} anos com sua alocação. ` +
    `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% (95% sucesso). ` +
    `Meta de FIRE pela regra ${withdrawalRate}%: ${targetMultiplier.toFixed(1)}× despesas anuais.`;

  const lifestyleSuccess = bootstrap.successRate;
  const fireProgress =
    fireTarget > 0 ? (effectivePatrimony / fireTarget) * 100 : 0;
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
        <div style={{ position: "relative" }}>
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
                Retirada constante (FIRE)
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
          Taxa: {withdrawalRate}% a.a.
        </Text>
        <Slider
          value={withdrawalRate}
          onChange={(_, value) => onWithdrawalRateChange(value as number)}
          min={2}
          max={6}
          step={0.5}
          marks
          size="medium"
          sx={sliderSx}
        />
        {!compact && (
          <>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Horizonte: {targetYears} anos
            </Text>
            <Slider
              value={targetYears}
              onChange={(_, value) => onTargetYearsChange(value as number)}
              min={20}
              max={80}
              step={5}
              marks
              size="medium"
              sx={sliderSx}
            />
            <PatrimonySimulator
              value={effectivePatrimony}
              onChange={setSimulatedPatrimony}
              onReset={() => setSimulatedPatrimony(null)}
              patrimonyTotal={patrimonyTotal}
              showReset={simulatedPatrimony !== null}
            />
            <ExpenseSimulator
              value={effectiveMonthlyExpenses}
              onChange={setSimulatedExpenses}
              onReset={() => setSimulatedExpenses(null)}
              avgMonthlyExpenses={avgExpenses}
              showReset={simulatedExpenses !== null}
            />
          </>
        )}
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={isAggressiveRate ? Colors.danger200 : Colors.neutral400}
            weight={isAggressiveRate ? FontWeights.MEDIUM : undefined}
          >
            {isAggressiveRate
              ? `⚠ Taxa de ${withdrawalRate}% tem apenas ${(rateBootstrap.successRate * 100).toFixed(0)}% de sucesso histórico em ${targetYears} anos. Limite seguro: ${safeRate.toFixed(2)}% (95% sucesso).`
              : `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% a.a. (95% sucesso histórico).`}
          </Text>
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
        // Disable the only-checked option (matches the /assets ROI chart
        // pattern of "Ativos abertos / Ativos fechados") so the user can
        // never end up with zero scenarios visible.
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
        // Acumulação chart: gap-to-target shrinking. Past p90 crossing all
        // bands are 0, so trim a few years after.
        const accTrimEnd =
          accumulation.p90YearsToTarget !== null
            ? Math.min(
                accumulation.gapBands.length,
                accumulation.p90YearsToTarget + 3,
              )
            : accumulation.gapBands.length;
        // X-axis uses age (consistent with the second chart) when DOB is set;
        // falls back to year-from-now when not. Each gapBand entry gets an
        // `age` field = currentAge + year for the chart to read.
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
              Acumulação · quanto falta para a meta
            </Text>
            {onMonthlySavingsChange && onMonthlySavingsReset && (
              <SavingsSimulator
                value={Math.max(0, monthlySavings)}
                onChange={onMonthlySavingsChange}
                onReset={onMonthlySavingsReset}
                avgMonthlySavings={Math.max(0, defaultMonthlySavings)}
                showReset={isMonthlySavingsOverridden}
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
                {/* For gap: smallest gap = best case = otimista → green → p10 */}
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
              // VPW-style chart: x-axis = projected age (so depletion age is
              // directly readable), y-axis = balance in BRL. Tooltip also
              // surfaces the per-year withdrawal so the user can see income
              // alongside patrimony at each age.
              const retirementAge =
                currentAge !== null &&
                accumulation.medianYearsToTarget !== null
                  ? currentAge + accumulation.medianYearsToTarget
                  : null;
              const drawdownData = drawdownAtTarget.bands.map((b, i) => {
                const wb =
                  i === 0 ? null : drawdownAtTarget.withdrawalBands[i - 1];
                return {
                  age:
                    retirementAge !== null
                      ? retirementAge + b.year
                      : b.year,
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
                      dataKey={retirementAge !== null ? "age" : "year"}
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
                          xLabel={retirementAge !== null ? "Idade" : "Ano"}
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

export default ConstantDollarIndicator;

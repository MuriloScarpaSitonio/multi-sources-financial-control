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
import FireSimulationResults from "./FireSimulationResults";
import { buildFirePatrimonyInputs } from "./fireResultPresentation";
import PatrimonySimulator from "./PatrimonySimulator";
import PersistedSlider from "./PersistedSlider";
import SavingsSimulator from "./SavingsSimulator";
import {
  computeWeights,
  findSafeWithdrawalRate,
  isIfixRestrictedSample,
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
  persistEnabled = false,
  isPersisting = false,
  simulatedPatrimony: simulatedPatrimonyProp,
  onSimulatedPatrimonyChange,
  simulatedExpenses: simulatedExpensesProp,
  onSimulatedExpensesChange,
  excludeIfixFromSim: excludeIfixFromSimProp,
  onExcludeIfixFromSimChange,
  onProgressClick,
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
  persistEnabled?: boolean;
  isPersisting?: boolean;
  // Optional lifted state. When both prop + setter are provided, the
  // PatrimonySimulator/ExpenseSimulator become controlled and the indicator
  // shares state with the page. Falls back to local state otherwise.
  simulatedPatrimony?: number | null;
  onSimulatedPatrimonyChange?: (value: number | null) => void;
  simulatedExpenses?: number | null;
  onSimulatedExpensesChange?: (value: number | null) => void;
  excludeIfixFromSim?: boolean;
  onExcludeIfixFromSimChange?: (value: boolean) => void;
  onProgressClick?: () => void;
}) => {
  const { hideValues } = useHideValues();
  const [localSimulatedPatrimony, setLocalSimulatedPatrimony] = useState<
    number | null
  >(null);
  const simulatedPatrimony =
    simulatedPatrimonyProp !== undefined
      ? simulatedPatrimonyProp
      : localSimulatedPatrimony;
  const setSimulatedPatrimony = (value: number | null) => {
    if (onSimulatedPatrimonyChange) onSimulatedPatrimonyChange(value);
    else setLocalSimulatedPatrimony(value);
  };
  // Which percentile bands + reference lines to render in the accumulation
  // chart. Defaults to all three; user can deselect via the toggle row.
  const [visibleScenarios, setVisibleScenarios] = useState<
    ("otimista" | "mediana" | "pessimista")[]
  >(["otimista", "mediana", "pessimista"]);
  // What-if simulator for expenses. Drives the entire indicator (fireTarget,
  // progress bar, accumulation chart, both drawdown charts) so the user can
  // explore "what if my expenses are R$ X" coherently. Reset returns to the
  // user's actual avg.
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
  const toggleScenario = (
    scenario: "otimista" | "mediana" | "pessimista",
    checked: boolean,
  ) => {
    setVisibleScenarios((prev) =>
      checked ? [...prev, scenario] : prev.filter((v) => v !== scenario),
    );
  };

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

  const rawWeights = useMemo(
    () => computeWeights(equityTotal, ifixTotal, fixedIncomeTotal),
    [equityTotal, ifixTotal, fixedIncomeTotal],
  );

  // "Excluir FII" toggle: when true, sim treats IFIX as cash earning 0% real.
  // Implementation: simWeights = {...rawWeights, ifix: 0} *without*
  // renormalizing. Weights then sum to (1 − rawWeights.ifix); the missing
  // fraction contributes 0 to per-year portfolio returns, so the IFIX slice
  // earns nothing real (no equity/FI redistribution). Sample window unlocks
  // because ifix=0 falls below MIN_WEIGHT_FOR_RETURN_SERIES.
  const [localExcludeIfixFromSim, setLocalExcludeIfixFromSim] = useState(false);
  const excludeIfixFromSim =
    excludeIfixFromSimProp ?? localExcludeIfixFromSim;
  const setExcludeIfixFromSim = (value: boolean) => {
    if (onExcludeIfixFromSimChange) onExcludeIfixFromSimChange(value);
    else setLocalExcludeIfixFromSim(value);
  };
  const weights = useMemo(
    () => (excludeIfixFromSim ? { ...rawWeights, ifix: 0 } : rawWeights),
    [rawWeights, excludeIfixFromSim],
  );
  const allocationLabel = useMemo(() => {
    const parts = [
      `${(weights.fixedIncome * 100).toFixed(0)}% RF`,
      `${(weights.equity * 100).toFixed(0)}% RV`,
    ];
    if (rawWeights.ifix > 0) {
      parts.push(
        excludeIfixFromSim
          ? "FII excluido"
          : `${(weights.ifix * 100).toFixed(0)}% FII`,
      );
    }
    return parts.join(" / ");
  }, [excludeIfixFromSim, rawWeights.ifix, weights]);

  // Bootstrap-derived horizon- and allocation-adjusted SWR. Used as the
  // honesty reference (warning chip + tooltip) and as the input to
  // horizonFactor below. The progress bar is driven by patrimony /
  // fireTarget, not by bootstrap success — see
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
  const patrimonyInputs = useMemo(
    () =>
      buildFirePatrimonyInputs({
        actualPatrimony: patrimonyTotal,
        simulatedPatrimony,
        fireTarget,
      }),
    [fireTarget, patrimonyTotal, simulatedPatrimony],
  );

  // Bar bootstrap: tests sustainability of the user's actual lifestyle
  // (annualExpenses) against the scenario patrimony. The patrimony slider is a
  // what-if input for this sustainability calculation only.
  const bootstrap = useMemo(
    () =>
      runBootstrap(
        patrimonyInputs.scenarioPatrimony,
        annualExpenses,
        targetYears,
        weights,
      ),
    [patrimonyInputs.scenarioPatrimony, annualExpenses, targetYears, weights],
  );

  // Secondary "rate test": is the slider rate historically safe at this
  // horizon and allocation? Scale-invariant (independent of patrimony), so
  // it answers a different question and is shown as a supporting indicator.
  const rateBootstrap = useMemo(
    () => runBootstrap(1_000_000, 1_000_000 * (withdrawalRate / 100), targetYears, weights),
    [withdrawalRate, targetYears, weights],
  );

  // Accumulation forecast: how long until real current patrimony + savings
  // crosses `fireTarget`? This deliberately ignores the patrimony what-if
  // slider; changing the slider must not make the retirement-date forecast
  // start from the simulated value.
  const annualSavings = Math.max(0, monthlySavings) * 12;
  const accumulation = useMemo(
    () =>
      runAccumulationBootstrap({
        startingBalance: patrimonyInputs.accumulationStartingPatrimony,
        annualContribution: annualSavings,
        target: fireTarget,
        weights,
      }),
    [
      patrimonyInputs.accumulationStartingPatrimony,
      annualSavings,
      fireTarget,
      weights,
    ],
  );

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const monthlyWithdrawalFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const monthlyExpensesFormatted = hideValues ? "***" : formatCurrency(effectiveMonthlyExpenses);
  // Flag the chosen rate as aggressive only when it produces meaningfully
  // worse historical success — not just barely above the 90% safe-rate
  // threshold. The 85% cutoff buffers against rounding noise around the safe
  // rate while still flagging genuinely risky picks.
  const isAggressiveRate = rateBootstrap.successRate < 0.85;
  const tooltipTitle =
    `Probabilidade histórica do patrimônio sustentar suas despesas (${monthlyExpensesFormatted}/mês, ` +
    `ajustadas por inflação) por ${targetYears} anos com sua alocação. ` +
    `Limite seguro p/ ${targetYears} anos: ${safeRate.toFixed(2)}% (90% sucesso). ` +
    `Meta de FIRE pela regra ${withdrawalRate}%: ${targetMultiplier.toFixed(1)}× despesas anuais.`;

  const lifestyleSuccess = bootstrap.successRate;
  const fireProgress = patrimonyInputs.scenarioProgress;
  const retirementProgress = patrimonyInputs.accumulationProgress;
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
            const compactTargetTail =
              retirementProgress < 100 &&
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
              simulatedPatrimony === null &&
              retirementProgress < 100 &&
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
      {!compact && isIfixRestrictedSample(rawWeights) && (
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
      {!compact && annualExpenses > 0 && (
        <FireSimulationResults
          patrimony={effectivePatrimony}
          currentPatrimony={patrimonyTotal}
          monthlyExpenses={effectiveMonthlyExpenses}
          monthlySavings={monthlySavings}
          annualExpenses={annualExpenses}
          withdrawalRate={withdrawalRate}
          targetYears={targetYears}
          safeRate={safeRate}
          fireTarget={fireTarget}
          fireProgress={fireProgress}
          retirementProgress={retirementProgress}
          allocationLabel={allocationLabel}
          bootstrap={bootstrap}
          rateBootstrap={rateBootstrap}
          accumulation={accumulation}
          currentAge={currentAge}
          showOtimista={showOtimista}
          showMediana={showMediana}
          showPessimista={showPessimista}
          onScenarioVisibilityChange={toggleScenario}
          hideValues={hideValues}
        />
      )}
      {!compact && annualExpenses > 0 && fireProgress >= 100 && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Sustentabilidade em {targetYears}a: {(lifestyleSuccess * 100).toFixed(0)}% · Sucesso da taxa {withdrawalRate}%: {(rateBootstrap.successRate * 100).toFixed(0)}% · Depleção p10: {p10DepletionLabel} · Mediana: {medianDepletionLabel}
          </Text>
        </Stack>
      )}
      {!compact && annualExpenses > 0 && retirementProgress < 100 && (
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
      {!compact && retirementProgress < 100 && accumulation.gapBands.length > 1 && (() => {
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
            <Stack gap={0.5} sx={{ mt: 2 }}>
              <Text
                size={FontSizes.SMALL}
                weight={FontWeights.SEMI_BOLD}
                color={Colors.neutral200}
              >
                Quando posso me aposentar?
              </Text>
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                O gráfico mostra quanto ainda falta para atingir a meta FIRE em
                cada ano. As linhas verticais marcam quando os cenários
                otimista, mediano e pessimista cruzam a meta.
              </Text>
            </Stack>
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

          </>
        );
      })()}
    </Stack>
  );
};

export default ConstantDollarIndicator;

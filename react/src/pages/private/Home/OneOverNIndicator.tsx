import { useMemo, useState } from "react";

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Bar,
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
import ExpensesSimulator from "./ExpensesSimulator";
import PatrimonySimulator from "./PatrimonySimulator";
import PersistedSlider from "./PersistedSlider";
import SavingsSimulator from "./SavingsSimulator";

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

type AccumulationPoint = {
  year: number;
  age: number;
  gap: number;
  patrimony: number;
};

type DrawdownPoint = {
  year: number;
  age: number;
  monthlyWithdrawal: number;
  remainingPatrimony: number;
};

const MAX_ACCUM_YEARS = 80;

const computeProjection = ({
  patrimony,
  monthlyExpenses,
  monthlySavings,
  realReturn,
  yearsRetirement,
  currentAge,
}: {
  patrimony: number;
  monthlyExpenses: number;
  monthlySavings: number;
  realReturn: number;
  yearsRetirement: number;
  currentAge: number;
}): {
  accumulation: AccumulationPoint[];
  drawdown: DrawdownPoint[];
  crossoverYear: number | null;
  initialGap: number;
  totalSpent: number;
  target: number;
} => {
  const target = yearsRetirement * 12 * monthlyExpenses;
  const initialGap = Math.max(0, target - patrimony);
  const r = realReturn / 100;

  // Phase 1: accumulation. balance grows with savings + return; gap = max(0, target - balance).
  const accumulation: AccumulationPoint[] = [];
  let balance = patrimony;
  let crossoverYear: number | null = balance >= target ? 0 : null;
  accumulation.push({
    year: 0,
    age: currentAge,
    gap: Math.max(0, target - balance),
    patrimony: balance,
  });
  if (crossoverYear === null) {
    for (let y = 1; y <= MAX_ACCUM_YEARS; y++) {
      balance = balance * (1 + r) + monthlySavings * 12;
      accumulation.push({
        year: y,
        age: currentAge + y,
        gap: Math.max(0, target - balance),
        patrimony: balance,
      });
      if (balance >= target) {
        crossoverYear = y;
        break;
      }
    }
  }

  // Phase 2: drawdown — per-year monthly withdrawal + remaining patrimony declining.
  const drawdown: DrawdownPoint[] = [];
  let totalSpent = 0;
  if (crossoverYear !== null) {
    let dBal = balance;
    drawdown.push({
      year: 0,
      age: currentAge + crossoverYear,
      monthlyWithdrawal: 0,
      remainingPatrimony: dBal,
    });
    for (let t = 0; t < yearsRetirement; t++) {
      const yearsLeft = yearsRetirement - t;
      const annualWithdrawal = dBal / yearsLeft;
      totalSpent += annualWithdrawal;
      dBal = (dBal - annualWithdrawal) * (1 + r);
      if (dBal < 0) dBal = 0;
      drawdown.push({
        year: t + 1,
        age: currentAge + crossoverYear + t + 1,
        monthlyWithdrawal: annualWithdrawal / 12,
        remainingPatrimony: dBal,
      });
      if (dBal === 0) break;
    }
  }

  return {
    accumulation,
    drawdown,
    crossoverYear,
    initialGap,
    totalSpent,
    target,
  };
};

const AccumulationTooltip = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: AccumulationPoint }[];
  hideValues?: boolean;
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
      <p style={{ color: getColor(Colors.neutral300) }}>
        Ano {data.year} (idade {data.age})
      </p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Patrimônio: {hideValues ? "***" : formatCurrency(data.patrimony)}
      </p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Falta juntar: {hideValues ? "***" : formatCurrency(data.gap)}
      </p>
    </Stack>
  );
};

const DrawdownTooltip = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: DrawdownPoint }[];
  hideValues?: boolean;
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
      <p style={{ color: getColor(Colors.neutral300) }}>
        Ano {data.year} de aposentadoria (idade {data.age})
      </p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Retirada:{" "}
        {hideValues ? "***" : formatCurrency(data.monthlyWithdrawal)}/mês
      </p>
      <p style={{ color: "#60a5fa" }}>
        Patrimônio restante:{" "}
        {hideValues ? "***" : formatCurrency(data.remainingPatrimony)}
      </p>
    </Stack>
  );
};

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const formatYearsAsCompactDuration = (years: number): string => {
  if (years <= 0) return "agora";
  return `~${years}a`;
};

type OneOverNIndicatorProps = {
  patrimonyTotal: number;
  avgExpenses: number;
  avgMonthlySavings: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetDepletionAge: number;
  onTargetDepletionAgeChange: (value: number) => void;
  realReturn: number;
  onRealReturnChange: (value: number) => void;
  compact?: boolean;
  hideLabel?: boolean;
  persistEnabled?: boolean;
  isPersisting?: boolean;
  simulatedSavings?: number | null;
  onSimulatedSavingsChange?: (value: number | null) => void;
  simulatedExpenses?: number | null;
  onSimulatedExpensesChange?: (value: number | null) => void;
};

const OneOverNIndicator = ({
  patrimonyTotal,
  avgExpenses,
  avgMonthlySavings,
  isLoading,
  dateOfBirth,
  targetDepletionAge,
  onTargetDepletionAgeChange,
  realReturn,
  onRealReturnChange,
  compact = false,
  hideLabel = false,
  persistEnabled = false,
  isPersisting = false,
  simulatedSavings: controlledSimulatedSavings,
  onSimulatedSavingsChange,
  simulatedExpenses: controlledSimulatedExpenses,
  onSimulatedExpensesChange,
}: OneOverNIndicatorProps) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [localSimulatedSavings, setLocalSimulatedSavings] = useState<number | null>(null);
  const [localSimulatedExpenses, setLocalSimulatedExpenses] = useState<number | null>(null);
  const simulatedSavings =
    controlledSimulatedSavings !== undefined
      ? controlledSimulatedSavings
      : localSimulatedSavings;
  const simulatedExpenses =
    controlledSimulatedExpenses !== undefined
      ? controlledSimulatedExpenses
      : localSimulatedExpenses;
  const setSimulatedSavings = (value: number | null) => {
    if (onSimulatedSavingsChange) onSimulatedSavingsChange(value);
    else setLocalSimulatedSavings(value);
  };
  const setSimulatedExpenses = (value: number | null) => {
    if (onSimulatedExpensesChange) onSimulatedExpensesChange(value);
    else setLocalSimulatedExpenses(value);
  };

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const effectiveSavings = simulatedSavings ?? Math.max(0, avgMonthlySavings);
  const effectiveExpenses = simulatedExpenses ?? avgExpenses;

  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;
  const yearsRemaining =
    currentAge !== null ? targetDepletionAge - currentAge : null;

  const projection = useMemo(() => {
    if (currentAge === null || yearsRemaining === null || yearsRemaining <= 0) {
      return null;
    }
    return computeProjection({
      patrimony: effectivePatrimony,
      monthlyExpenses: effectiveExpenses,
      monthlySavings: effectiveSavings,
      realReturn,
      yearsRetirement: yearsRemaining,
      currentAge,
    });
  }, [
    effectivePatrimony,
    effectiveExpenses,
    effectiveSavings,
    realReturn,
    yearsRemaining,
    currentAge,
  ]);

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
          Retirada 1/N — configure sua data de nascimento no perfil
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
          Retirada 1/N — idade alvo deve ser maior que sua idade atual (
          {currentAge})
        </Text>
      </Stack>
    );
  }

  const withdrawalPct = (1 / yearsRemaining) * 100;
  const annualWithdrawal = effectivePatrimony / yearsRemaining;
  const monthlyWithdrawal = annualWithdrawal / 12;
  const coverage =
    effectiveExpenses > 0
      ? (monthlyWithdrawal / effectiveExpenses) * 100
      : 0;

  const monthlyFormatted = hideValues
    ? "***"
    : formatCurrency(monthlyWithdrawal);
  const tooltipTitle =
    `Retirada 1/N: divida o patrimônio pelos anos restantes. ` +
    `Idade: ${currentAge}, meta: ${targetDepletionAge}, anos restantes: ${yearsRemaining}. ` +
    `Retirada: ${withdrawalPct.toFixed(1)}% a.a. (${monthlyFormatted}/mês). ` +
    `O patrimônio será totalmente consumido até a idade alvo.`;

  const crossoverYear = projection?.crossoverYear ?? null;
  const initialGap = projection?.initialGap ?? 0;
  const target = projection?.target ?? 0;

  let gapLabel: string;
  let timeLabel: string;
  let gapIsBad = false;
  let timeIsBad = false;
  if (initialGap === 0) {
    gapLabel = "Já cobre o alvo 1/N";
    timeLabel = `Pode aposentar hoje aos ${currentAge} anos`;
  } else if (crossoverYear !== null) {
    gapLabel = `Falta juntar ${
      hideValues ? "***" : formatCurrency(initialGap)
    } para começar 1/N hoje`;
    timeLabel = `Em ${crossoverYear} ${
      crossoverYear === 1 ? "ano" : "anos"
    } no seu ritmo (aposenta aos ${currentAge + crossoverYear})`;
    gapIsBad = true;
  } else {
    gapLabel = `Falta juntar ${
      hideValues ? "***" : formatCurrency(initialGap)
    } para começar 1/N hoje`;
    timeLabel = `Mais de ${MAX_ACCUM_YEARS} anos no seu ritmo — aumente poupança ou retorno`;
    gapIsBad = true;
    timeIsBad = true;
  }

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
                Retirada 1/N
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
                {coverage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {compact
            ? `Meta: ${hideValues ? "***" : formatCurrency(target)}${
                initialGap > 0 && crossoverYear !== null
                  ? ` (${formatYearsAsCompactDuration(crossoverYear)} no ritmo atual)`
                  : ""
              }`
            : `N = ${targetDepletionAge} − ${currentAge} = ${yearsRemaining} anos · 1/${yearsRemaining} = ${withdrawalPct.toFixed(1)}% · ${
                hideValues ? "***" : formatCurrency(monthlyWithdrawal)
              }/mês`}
        </Text>
        {!compact && (
          <>
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={gapIsBad ? Colors.danger200 : Colors.brand}
              weight={FontWeights.MEDIUM}
            >
              {gapLabel}
            </Text>
            <Text
              size={FontSizes.EXTRA_SMALL}
              color={timeIsBad ? Colors.danger200 : Colors.neutral200}
              weight={FontWeights.MEDIUM}
            >
              {timeLabel}
            </Text>
          </>
        )}
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <PersistedSlider
            value={targetDepletionAge}
            onChange={onTargetDepletionAgeChange}
            renderLabel={(v) => (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                Idade alvo: {v}
              </Text>
            )}
            enabled={persistEnabled}
            isPersisting={isPersisting}
            min={70}
            max={105}
            step={1}
            marks={Array.from({ length: 36 }, (_, i) => ({
              value: 70 + i,
              label: "",
            }))}
          />
          <PersistedSlider
            value={realReturn}
            onChange={onRealReturnChange}
            renderLabel={(v) => (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                Retorno real: {v.toFixed(1)}%
              </Text>
            )}
            enabled={persistEnabled}
            isPersisting={isPersisting}
            min={1}
            max={8}
            step={0.5}
            marks={Array.from({ length: 15 }, (_, i) => ({
              value: 1 + i * 0.5,
              label: "",
            }))}
          />
          <PatrimonySimulator
            value={effectivePatrimony}
            onChange={setSimulatedPatrimony}
            onReset={() => setSimulatedPatrimony(null)}
            patrimonyTotal={patrimonyTotal}
            showReset={simulatedPatrimony !== null}
            isPersisting={isPersisting}
          />
          <SavingsSimulator
            value={effectiveSavings}
            onChange={setSimulatedSavings}
            onReset={() => setSimulatedSavings(null)}
            avgMonthlySavings={Math.max(0, avgMonthlySavings)}
            showReset={simulatedSavings !== null}
            enabled={persistEnabled}
            isPersisting={isPersisting}
          />
          <ExpensesSimulator
            value={effectiveExpenses}
            onChange={setSimulatedExpenses}
            onReset={() => setSimulatedExpenses(null)}
            avgExpenses={avgExpenses}
            showReset={simulatedExpenses !== null}
            enabled={persistEnabled}
            isPersisting={isPersisting}
          />
        </Stack>
      )}
      {!compact && projection && projection.accumulation.length > 1 && (
        <Stack gap={1} sx={{ mt: 2 }}>
          <Text
            size={FontSizes.SMALL}
            weight={FontWeights.SEMI_BOLD}
            color={Colors.neutral200}
          >
            Acumulação — quanto falta e em quanto tempo
          </Text>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={projection.accumulation}
              margin={{ top: 18, right: 90, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey="year"
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                tickFormatter={(v) => `${v}a`}
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
                content={<AccumulationTooltip hideValues={hideValues} />}
              />
              <Line
                type="monotone"
                dataKey="patrimony"
                stroke={getColor(Colors.brand400)}
                strokeWidth={2.5}
                dot={false}
                name="Patrimônio"
              />
              <Line
                type="monotone"
                dataKey="gap"
                stroke={getColor(Colors.danger200)}
                strokeWidth={2.5}
                dot={false}
                name="Falta juntar"
              />
              {crossoverYear !== null && crossoverYear > 0 && (
                <ReferenceLine
                  x={crossoverYear}
                  stroke={getColor(Colors.brand)}
                  strokeDasharray="3 3"
                  label={{
                    value: `aposenta aos ${currentAge + crossoverYear} anos`,
                    position: "top",
                    fill: getColor(Colors.brand),
                    fontSize: 12,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Stack>
      )}
      {!compact && projection && projection.drawdown.length > 1 && (
        <Stack gap={1} sx={{ mt: 2 }}>
          <Text
            size={FontSizes.SMALL}
            weight={FontWeights.SEMI_BOLD}
            color={Colors.neutral200}
          >
            Aposentadoria — após atingir o alvo, como 1/N se comporta
          </Text>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={projection.drawdown}
              margin={{ top: 18, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey="year"
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                tickFormatter={(v) => `${v}a`}
              />
              <YAxis
                yAxisId="left"
                stroke={getColor(Colors.brand400)}
                tickLine={false}
                axisLine={false}
                tickFormatter={numberTickFormatter}
                tickCount={hideValues ? 0 : undefined}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#60a5fa"
                tickLine={false}
                axisLine={false}
                tickFormatter={numberTickFormatter}
                tickCount={hideValues ? 0 : undefined}
              />
              <RechartsTooltip
                cursor={false}
                content={<DrawdownTooltip hideValues={hideValues} />}
              />
              <Bar
                yAxisId="left"
                dataKey="monthlyWithdrawal"
                fill={getColor(Colors.brand400)}
                fillOpacity={0.55}
                stroke={getColor(Colors.brand)}
                strokeWidth={1}
                name="Retirada/mês"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="remainingPatrimony"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
                name="Patrimônio restante"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Stack>
      )}
    </Stack>
  );
};

export default OneOverNIndicator;

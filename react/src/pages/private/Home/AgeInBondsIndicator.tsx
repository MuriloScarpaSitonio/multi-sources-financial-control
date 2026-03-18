import { useMemo, useState } from "react";

import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  ComposedChart,
  Area,
  Line,
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
  NumberFormat,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";

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

const sliderSx = {
  width: 100,
  "& .MuiSlider-thumb": {
    width: 14,
    height: 14,
    backgroundColor: getColor(Colors.brand500),
    "&:hover, &.Mui-focusVisible": {
      boxShadow: `0 0 0 8px ${getColor(Colors.brand500)}33`,
    },
  },
  "& .MuiSlider-track": {
    backgroundColor: getColor(Colors.brand500),
    border: "none",
  },
  "& .MuiSlider-rail": {
    backgroundColor: getColor(Colors.brand500),
  },
};

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

type ProjectionPoint = {
  age: number;
  withdrawal: number;
  expenses: number;
  portfolio: number;
  bondPct: number;
};

const computeProjection = (
  portfolio: number,
  avgMonthlyExpenses: number,
  currentAge: number,
  withdrawalRate: number,
  stockReturn: number,
  bondReturn: number,
): ProjectionPoint[] => {
  const points: ProjectionPoint[] = [];
  let balance = portfolio;

  for (let age = currentAge; age <= 100 && balance > 0; age++) {
    const bondPct = Math.min(age, 100);
    const stockPct = 100 - bondPct;
    const blendedReturn = (bondPct * bondReturn + stockPct * stockReturn) / 100;

    const annualWithdrawal = balance * (withdrawalRate / 100);
    const monthlyWithdrawal = annualWithdrawal / 12;

    points.push({
      age,
      withdrawal: monthlyWithdrawal,
      expenses: avgMonthlyExpenses,
      portfolio: balance,
      bondPct,
    });

    balance = (balance - annualWithdrawal) * (1 + blendedReturn / 100);
    if (balance < 0) balance = 0;
  }
  return points;
};

const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: { payload: ProjectionPoint }[];
  hideValues?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const gap = data.withdrawal - data.expenses;
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
        Idade: {data.age} ({data.bondPct}% RF / {100 - data.bondPct}% RV)
      </p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Retirada: {hideValues ? "***" : formatCurrency(data.withdrawal)}/mês
      </p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Despesas: {hideValues ? "***" : formatCurrency(data.expenses)}/mês
      </p>
      <p style={{ color: gap >= 0 ? getColor(Colors.brand) : getColor(Colors.danger200) }}>
        {gap >= 0 ? "Sobra" : "Falta"}: {hideValues ? "***" : formatCurrency(Math.abs(gap))}/mês
      </p>
      <p style={{ color: getColor(Colors.neutral300) }}>
        Patrimônio: {hideValues ? "***" : formatCurrency(data.portfolio)}
      </p>
    </Stack>
  );
};

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const AgeInBondsIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  dateOfBirth,
  fixedIncomeTotal,
  variableIncomeTotal,
  withdrawalRate,
  onWithdrawalRateChange,
  stockReturn,
  onStockReturnChange,
  bondReturn,
  onBondReturnChange,
  compact = false,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  withdrawalRate: number;
  onWithdrawalRateChange: (value: number) => void;
  stockReturn: number;
  onStockReturnChange: (value: number) => void;
  bondReturn: number;
  onBondReturnChange: (value: number) => void;
  compact?: boolean;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;

  const investmentTotal = fixedIncomeTotal + variableIncomeTotal;
  const currentBondPct = investmentTotal > 0 ? (fixedIncomeTotal / investmentTotal) * 100 : 0;
  const targetBondPct = currentAge !== null ? Math.min(currentAge, 100) : 0;
  const isOnTarget = Math.abs(currentBondPct - targetBondPct) <= 5;

  const rebalanceAmount = investmentTotal > 0
    ? (targetBondPct / 100) * investmentTotal - fixedIncomeTotal
    : 0;

  const annualWithdrawal = effectivePatrimony * (withdrawalRate / 100);
  const monthlyWithdrawal = annualWithdrawal / 12;
  const coverage = avgExpenses > 0 ? (monthlyWithdrawal / avgExpenses) * 100 : 0;

  const projection = useMemo(() => {
    if (currentAge === null) return [];
    return computeProjection(
      effectivePatrimony,
      avgExpenses,
      currentAge,
      withdrawalRate,
      stockReturn,
      bondReturn,
    );
  }, [effectivePatrimony, avgExpenses, currentAge, withdrawalRate, stockReturn, bondReturn]);

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
          % Constante (Idade em RF) — configure sua data de nascimento no perfil
        </Text>
      </Stack>
    );
  }

  const monthlyFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const tooltipTitle =
    `Retirada % Constante com alocação Idade em Renda Fixa. ` +
    `Idade: ${currentAge}, meta de RF: ${targetBondPct}%, atual: ${currentBondPct.toFixed(1)}%. ` +
    `Retirada: ${withdrawalRate}% a.a. (${monthlyFormatted}/mês). ` +
    `A alocação em renda fixa acompanha sua idade, reduzindo risco progressivamente.`;

  const patrimonyStep = 50000;
  const patrimonyMax = Math.max(patrimonyTotal * 5, 1000000);

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
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              % Constante (Idade em RF)
            </Text>
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
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {withdrawalRate}% a.a. · {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
          {" · "}
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
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Saque: {withdrawalRate}% a.a.
        </Text>
        <Slider
          value={withdrawalRate}
          onChange={(_, value) => onWithdrawalRateChange(value as number)}
          min={2}
          max={8}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        {!compact && (
          <>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Retorno RV: {stockReturn}%
            </Text>
            <Slider
              value={stockReturn}
              onChange={(_, value) => onStockReturnChange(value as number)}
              min={3}
              max={15}
              step={0.5}
              size="medium"
              sx={sliderSx}
            />
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Retorno RF: {bondReturn}%
            </Text>
            <Slider
              value={bondReturn}
              onChange={(_, value) => onBondReturnChange(value as number)}
              min={1}
              max={8}
              step={0.5}
              size="medium"
              sx={sliderSx}
            />
          </>
        )}
      </Stack>
      {!compact && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Patrimônio:
          </Text>
          <TextField
            value={effectivePatrimony}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v >= 0) setSimulatedPatrimony(v);
            }}
            size="small"
            slotProps={{
              input: {
                inputComponent: NumberFormat,
                inputProps: { prefix: "R$ ", decimalScale: 2 },
              } as any,
            }}
            sx={{
              width: 180,
              "& .MuiInputBase-input": {
                color: getColor(Colors.neutral0),
                fontSize: 12,
                py: 0.5,
              },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: getColor(Colors.neutral600) },
              },
            }}
          />
          <Slider
            value={effectivePatrimony}
            onChange={(_, value) => setSimulatedPatrimony(value as number)}
            min={0}
            max={patrimonyMax}
            step={patrimonyStep}
            size="medium"
            sx={{ ...sliderSx, width: 200 }}
          />
          {simulatedPatrimony !== null && (
            <Button
              variant="brand-text"
              size="small"
              onClick={() => setSimulatedPatrimony(null)}
            >
              Resetar
            </Button>
          )}
        </Stack>
      )}
      {!compact && projection.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={projection}
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
              stroke={getColor(Colors.neutral0)}
              tickLine={false}
              axisLine={false}
              tickFormatter={numberTickFormatter}
              tickCount={hideValues ? 0 : undefined}
            />
            <RechartsTooltip
              cursor={false}
              content={<ChartTooltipContent hideValues={hideValues} />}
            />
            <Area
              type="monotone"
              dataKey="withdrawal"
              stroke={getColor(Colors.brand400)}
              fill={getColor(Colors.brand400)}
              fillOpacity={0.15}
              strokeWidth={2}
              name="Retirada"
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke={getColor(Colors.danger200)}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Despesas"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default AgeInBondsIndicator;

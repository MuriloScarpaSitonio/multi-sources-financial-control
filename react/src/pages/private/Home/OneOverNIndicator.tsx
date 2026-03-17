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
};

const computeProjection = (
  portfolio: number,
  avgMonthlyExpenses: number,
  currentAge: number,
  targetAge: number,
  realReturn: number,
  inflation: number,
): ProjectionPoint[] => {
  const points: ProjectionPoint[] = [];
  let balance = portfolio;
  let annualExpenses = avgMonthlyExpenses * 12;

  for (let age = currentAge; age < targetAge; age++) {
    const remaining = targetAge - age;
    const monthlyWithdrawal = balance / remaining / 12;
    points.push({
      age,
      withdrawal: monthlyWithdrawal,
      expenses: annualExpenses / 12,
    });
    balance = (balance - balance / remaining) * (1 + realReturn / 100);
    annualExpenses *= 1 + inflation / 100;
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
      <p style={{ color: getColor(Colors.neutral300) }}>Idade: {data.age}</p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Retirada: {hideValues ? "***" : formatCurrency(data.withdrawal)}/mês
      </p>
      <p style={{ color: getColor(Colors.danger200) }}>
        Despesas: {hideValues ? "***" : formatCurrency(data.expenses)}/mês
      </p>
      <p style={{ color: gap >= 0 ? getColor(Colors.brand) : getColor(Colors.danger200) }}>
        {gap >= 0 ? "Sobra" : "Falta"}: {hideValues ? "***" : formatCurrency(Math.abs(gap))}/mês
      </p>
    </Stack>
  );
};

const numberTickFormatter = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const OneOverNIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  dateOfBirth,
  targetDepletionAge,
  onTargetDepletionAgeChange,
  realReturn,
  onRealReturnChange,
  inflation,
  onInflationChange,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  dateOfBirth: string | null;
  targetDepletionAge: number;
  onTargetDepletionAgeChange: (value: number) => void;
  realReturn: number;
  onRealReturnChange: (value: number) => void;
  inflation: number;
  onInflationChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;
  const yearsRemaining =
    currentAge !== null ? targetDepletionAge - currentAge : null;

  const projection = useMemo(() => {
    if (currentAge === null || yearsRemaining === null || yearsRemaining <= 0)
      return [];
    return computeProjection(
      effectivePatrimony,
      avgExpenses,
      currentAge,
      targetDepletionAge,
      realReturn,
      inflation,
    );
  }, [
    effectivePatrimony,
    avgExpenses,
    currentAge,
    targetDepletionAge,
    realReturn,
    inflation,
    yearsRemaining,
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
    avgExpenses > 0 ? (monthlyWithdrawal / avgExpenses) * 100 : 0;

  const monthlyFormatted = hideValues
    ? "***"
    : formatCurrency(monthlyWithdrawal);
  const tooltipTitle =
    `Retirada 1/N: divida o patrimônio pelos anos restantes. ` +
    `Idade: ${currentAge}, meta: ${targetDepletionAge}, anos restantes: ${yearsRemaining}. ` +
    `Retirada: ${withdrawalPct.toFixed(1)}% a.a. (${monthlyFormatted}/mês). ` +
    `O patrimônio será totalmente consumido até a idade alvo.`;

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
              Retirada 1/N
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
          N = {targetDepletionAge} − {currentAge} = {yearsRemaining} anos · 1/
          {yearsRemaining} = {withdrawalPct.toFixed(1)}% ·{" "}
          {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Idade alvo: {targetDepletionAge}
        </Text>
        <Slider
          value={targetDepletionAge}
          onChange={(_, value) => onTargetDepletionAgeChange(value as number)}
          min={70}
          max={105}
          step={1}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Retorno real: {realReturn.toFixed(1)}%
        </Text>
        <Slider
          value={realReturn}
          onChange={(_, value) => onRealReturnChange(value as number)}
          min={1}
          max={8}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Inflação: {inflation.toFixed(1)}%
        </Text>
        <Slider
          value={inflation}
          onChange={(_, value) => onInflationChange(value as number)}
          min={0}
          max={10}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400} extraStyle={{ marginLeft: 4 }}>
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
      {projection.length > 0 && (
        <>
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
        </>
      )}
    </Stack>
  );
};

export default OneOverNIndicator;

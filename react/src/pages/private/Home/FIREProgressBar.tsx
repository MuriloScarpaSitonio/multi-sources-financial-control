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
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
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

const FIRELinearProgress = styled(LinearProgress)(({ value }) => ({
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

type ProjectionPoint = {
  year: number;
  withdrawal: number;
  portfolio: number;
};

const computeProjection = (
  portfolio: number,
  withdrawalRate: number,
  realReturn: number,
  years: number,
): ProjectionPoint[] => {
  const points: ProjectionPoint[] = [];
  let balance = portfolio;

  for (let year = 0; year <= years; year++) {
    const annualWithdrawal = balance * (withdrawalRate / 100);
    points.push({
      year,
      withdrawal: annualWithdrawal / 12,
      portfolio: Math.max(balance, 0),
    });
    balance = (balance - annualWithdrawal) * (1 + realReturn / 100);
  }
  return points;
};

const numberTickFormatter = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const ChartTooltipContent = ({
  active,
  payload,
  hideValues,
  avgExpenses,
}: {
  active?: boolean;
  payload?: { payload: ProjectionPoint }[];
  hideValues?: boolean;
  avgExpenses: number;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const gap = data.withdrawal - avgExpenses;
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
      <p style={{ color: getColor(Colors.brand400) }}>
        Retirada: {hideValues ? "***" : formatCurrency(data.withdrawal)}/mês
      </p>
      <p style={{ color: getColor(Colors.neutral400) }}>
        Patrimônio: {hideValues ? "***" : formatCurrency(data.portfolio)}
      </p>
      <p style={{ color: gap >= 0 ? getColor(Colors.brand) : getColor(Colors.danger200) }}>
        {gap >= 0 ? "Sobra" : "Falta"}: {hideValues ? "***" : formatCurrency(Math.abs(gap))}/mês
      </p>
    </Stack>
  );
};

const FIREProgressBar = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  multiplier,
  onMultiplierChange,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  multiplier: number;
  onMultiplierChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const [realReturn, setRealReturn] = useState(5);
  const [horizon, setHorizon] = useState(30);

  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;
  const annualExpenses = avgExpenses * 12;
  const fireNumber = annualExpenses * multiplier;
  const fireProgress = fireNumber > 0 ? (effectivePatrimony / fireNumber) * 100 : 0;
  const withdrawalRate = (100 / multiplier).toFixed(1);
  const monthlyWithdrawal = effectivePatrimony * (100 / multiplier / 100) / 12;

  const projection = useMemo(
    () =>
      computeProjection(
        effectivePatrimony,
        100 / multiplier,
        realReturn,
        horizon,
      ),
    [effectivePatrimony, multiplier, realReturn, horizon],
  );

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const annualExpensesFormatted = hideValues ? "***" : formatCurrency(annualExpenses);
  const monthlyWithdrawalFormatted = hideValues ? "***" : formatCurrency(monthlyWithdrawal);
  const tooltipTitle = `Patrimônio / (despesas anuais × ${multiplier}). Despesas anuais: ${annualExpensesFormatted}. Meta: acumular ${multiplier}x suas despesas anuais para viver dos rendimentos (regra dos ${withdrawalRate}%). Retirada mensal: ${monthlyWithdrawalFormatted}`;

  const patrimonyStep = 50000;
  const patrimonyMax = Math.max(patrimonyTotal * 5, 1000000);

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <FIRELinearProgress
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
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Independência financeira (FIRE)
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
                {fireProgress.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {multiplier}x ({withdrawalRate}%) ·{" "}
          {hideValues ? "***" : formatCurrency(monthlyWithdrawal)}/mês
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Multiplicador: {multiplier}x
        </Text>
        <Slider
          value={multiplier}
          onChange={(_, value) => onMultiplierChange(value as number)}
          min={25}
          max={35}
          step={1}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Retorno real: {realReturn.toFixed(1)}%
        </Text>
        <Slider
          value={realReturn}
          onChange={(_, value) => setRealReturn(value as number)}
          min={1}
          max={8}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Horizonte: {horizon} anos
        </Text>
        <Slider
          value={horizon}
          onChange={(_, value) => setHorizon(value as number)}
          min={10}
          max={80}
          step={5}
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
      {projection.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={projection}
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
              yAxisId="left"
              stroke={getColor(Colors.brand400)}
              tickLine={false}
              axisLine={false}
              tickFormatter={numberTickFormatter}
              tickCount={hideValues ? 0 : undefined}
              domain={[0, (dataMax: number) => Math.max(dataMax, avgExpenses * 1.3)]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={getColor(Colors.brand100)}
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
                  avgExpenses={avgExpenses}
                />
              }
            />
            <ReferenceLine
              yAxisId="left"
              y={avgExpenses}
              stroke={getColor(Colors.danger200)}
              strokeDasharray="5 5"
              label={{
                value: hideValues ? "***" : `Despesas: ${formatCurrency(avgExpenses)}`,
                fill: getColor(Colors.danger200),
                fontSize: 11,
                position: "insideTopLeft",
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="withdrawal"
              stroke={getColor(Colors.brand400)}
              strokeWidth={2}
              dot={false}
              name="Retirada mensal"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="portfolio"
              stroke={getColor(Colors.brand100)}
              strokeWidth={1.5}
              dot={false}
              name="Patrimônio restante"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default FIREProgressBar;

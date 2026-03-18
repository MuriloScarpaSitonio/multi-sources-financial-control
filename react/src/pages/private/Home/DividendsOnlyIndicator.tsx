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

type ProjectionPoint = {
  patrimony: number;
  income: number;
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
  const gap = data.income - avgExpenses;
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
        Patrimônio: {hideValues ? "***" : formatCurrency(data.patrimony)}
      </p>
      <p style={{ color: getColor(Colors.brand400) }}>
        Proventos: {hideValues ? "***" : formatCurrency(data.income)}/mês
      </p>
      <p style={{ color: gap >= 0 ? getColor(Colors.brand) : getColor(Colors.danger200) }}>
        {gap >= 0 ? "Sobra" : "Falta"}: {hideValues ? "***" : formatCurrency(Math.abs(gap))}/mês
      </p>
    </Stack>
  );
};

const DividendsOnlyIndicator = ({
  avgPassiveIncome,
  avgExpenses,
  patrimonyTotal,
  isLoading,
  compact = false,
}: {
  avgPassiveIncome: number;
  avgExpenses: number;
  patrimonyTotal: number;
  isLoading: boolean;
  compact?: boolean;
}) => {
  const { hideValues } = useHideValues();
  const currentYield = patrimonyTotal > 0 ? (avgPassiveIncome * 12 / patrimonyTotal) * 100 : 6;
  const [simulatedYield, setSimulatedYield] = useState<number | null>(null);
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(null);
  const effectiveYield = simulatedYield ?? currentYield;
  const effectivePatrimony = simulatedPatrimony ?? patrimonyTotal;

  const simulatedMonthlyIncome = (effectivePatrimony * (effectiveYield / 100)) / 12;
  const displayIncome = simulatedPatrimony !== null || simulatedYield !== null
    ? simulatedMonthlyIncome
    : avgPassiveIncome;
  const coveragePercentage =
    avgExpenses > 0 ? (displayIncome / avgExpenses) * 100 : 0;

  // For the chart: given a yield %, how much income does each patrimony level generate?
  const projection = useMemo(() => {
    const points: ProjectionPoint[] = [];
    const max = Math.max(effectivePatrimony * 2, 2000000);
    const step = max / 20;
    for (let p = 0; p <= max; p += step) {
      points.push({
        patrimony: p,
        income: (p * (effectiveYield / 100)) / 12,
      });
    }
    return points;
  }, [effectivePatrimony, effectiveYield]);

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const avgPassiveIncomeFormatted = hideValues
    ? "***"
    : formatCurrency(avgPassiveIncome);
  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Viver apenas de proventos: média mensal de proventos (${avgPassiveIncomeFormatted}) / média mensal de despesas FIRE (${avgExpensesFormatted}). Meta: 100% para cobrir todas as despesas apenas com dividendos e proventos.`;

  const requiredPatrimony =
    effectiveYield > 0
      ? (avgExpenses * 12) / (effectiveYield / 100)
      : 0;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar
            variant="determinate"
            value={Math.min(coveragePercentage, 100)}
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
              Viver de proventos
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
                {coveragePercentage.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Proventos: {hideValues ? "***" : formatCurrency(displayIncome)}/mês
          {" · "}Despesas: {hideValues ? "***" : formatCurrency(avgExpenses)}/mês
          {effectiveYield > 0 && (
            <>
              {" · "}Para cobrir 100% (com yield de {effectiveYield.toFixed(1)}%):{" "}
              {hideValues ? "***" : formatCurrency(requiredPatrimony)}
            </>
          )}
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Yield: {effectiveYield.toFixed(1)}% a.a.
        </Text>
        <Slider
          value={effectiveYield}
          onChange={(_, value) => setSimulatedYield(value as number)}
          min={1}
          max={15}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        {!compact && (
          <>
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
              max={5000000}
              step={50000}
              size="medium"
              sx={{ ...sliderSx, width: 200 }}
            />
            {(simulatedPatrimony !== null || simulatedYield !== null) && (
              <Button
                variant="brand-text"
                size="small"
                onClick={() => {
                  setSimulatedPatrimony(null);
                  setSimulatedYield(null);
                }}
              >
                Resetar
              </Button>
            )}
          </>
        )}
      </Stack>
      {!compact && projection.length > 1 && (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={projection}
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="5" vertical={false} />
            <XAxis
              dataKey="patrimony"
              stroke={getColor(Colors.neutral0)}
              tickLine={false}
              tickFormatter={numberTickFormatter}
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
                <ChartTooltipContent
                  hideValues={hideValues}
                  avgExpenses={avgExpenses}
                />
              }
            />
            <ReferenceLine
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
              type="monotone"
              dataKey="income"
              stroke={getColor(Colors.brand400)}
              strokeWidth={2}
              dot={false}
              name="Proventos mensais"
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Stack>
  );
};

export default DividendsOnlyIndicator;

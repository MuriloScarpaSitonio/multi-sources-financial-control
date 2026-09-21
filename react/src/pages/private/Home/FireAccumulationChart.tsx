import Stack from "@mui/material/Stack";
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
import { formatCurrency } from "../utils";
import type { AccumulationResult, BootstrapBand } from "./fireBootstrap";

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
          Pessimista ({pessimistaPercentile}):{" "}
          {hideValues ? "***" : valueFormatter(pessimistaValue)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {hideValues ? "***" : valueFormatter(data.p50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista ({otimistaPercentile}):{" "}
          {hideValues ? "***" : valueFormatter(otimistaValue)}
        </p>
      )}
    </Stack>
  );
};

const FireAccumulationChart = ({
  accumulation,
  currentAge,
  hideValues,
  showOtimista,
  showMediana,
  showPessimista,
}: {
  accumulation: AccumulationResult;
  currentAge: number | null;
  hideValues: boolean;
  showOtimista: boolean;
  showMediana: boolean;
  showPessimista: boolean;
}) => {
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
    useAgeAxis ? `aos ${(currentAge as number) + years}` : `em ${years} anos`;
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
          O gráfico mostra quanto ainda falta para atingir a meta FIRE em cada
          ano. As linhas verticais marcam quando os cenários otimista, mediano e
          pessimista cruzam a meta.
        </Text>
      </Stack>

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
};

export default FireAccumulationChart;

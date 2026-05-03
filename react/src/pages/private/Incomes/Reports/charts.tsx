import Stack from "@mui/material/Stack";

import {
  Bar,
  BarChart,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartType,
  Colors,
  FontSizes,
  getColor,
  Text,
  StatusDot,
} from "../../../../design-system";
import { HistoricReportResponse, TopAssetsResponse } from "../types";
import {
  monthTickerFormatter,
  numberTickFormatter,
  yearTickerFormatter,
} from "../../utils";
import { useHideValues } from "../../../../hooks/useHideValues";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300 * 1.25;

const LegendContent = (props?: {
  payload?: {
    payload?: {
      dataKey: string;
      stroke: string;
      strokeDasharray: string;
      fill: string;
      name: string;
    };
  }[];
}) => {
  const [first, second] = props?.payload ?? [];
  return (
    <Stack
      direction="row"
      gap={2}
      alignSelf="center"
      justifyContent="center"
      marginTop={0.5}
      marginBottom={1.5}
    >
      <Stack direction="row" gap={0.5} alignItems="center">
        <StatusDot
          variant="custom"
          color={first?.payload?.fill}
          stroke={first?.payload?.stroke}
          strokeDasharray={first?.payload?.strokeDasharray ? "2 2" : undefined}
        />
        <Text colors={Colors.neutral300} size={FontSizes.SMALL}>
          {first?.payload?.name}
        </Text>
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center">
        <StatusDot
          variant="custom"
          color={second?.payload?.fill}
          stroke={second?.payload?.stroke}
          strokeDasharray={second?.payload?.strokeDasharray ? "2 2" : undefined}
        />
        <Text colors={Colors.neutral300} size={FontSizes.SMALL}>
          {second?.payload?.name}
        </Text>
      </Stack>
    </Stack>
  );
};

const HorizontalBarChartToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: TopAssetsResponse[number];
  }[];
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(Colors.brand100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p style={{ color: getColor(Colors.neutral300) }}>
          {`Ativo: ${data.code}`}
        </p>
        <p style={{ color: getColor(Colors.brand200) }}>
          {`Total creditado: R$ ${data.credited.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p style={{ color: getColor(Colors.brand100) }}>
          {`Total provisionado: R$ ${data.provisioned.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </Stack>
    );
  }
};

export const HorizontalBarChart = ({ data }: { data: TopAssetsResponse }) => {
  const { hideValues } = useHideValues();
  return (
    <BarChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      data={data}
      layout="vertical"
      margin={{ left: 55 }}
    >
      <CartesianGrid strokeDasharray="5" horizontal={false} />
      <XAxis
        type="number"
        stroke={getColor(Colors.neutral0)}
        tickFormatter={numberTickFormatter}
        tickLine={false}
        tickCount={hideValues ? 0 : undefined}
      />
      <YAxis
        type="category"
        dataKey="code"
        stroke={getColor(Colors.neutral0)}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip cursor={false} content={<HorizontalBarChartToolTipContent />} />
      <Legend verticalAlign="top" content={<LegendContent />} />
      <Bar
        dataKey="credited"
        stackId="a"
        radius={[0, 5, 5, 0]}
        fill={getColor(Colors.brand200)}
        name="Creditado"
      />
      <Bar
        dataKey="provisioned"
        stackId="a"
        radius={[0, 5, 5, 0]}
        fill={getColor(Colors.neutral900)}
        stroke={getColor(Colors.brand100)}
        strokeWidth={1}
        strokeDasharray="3 3"
        name="Provisionado"
      />
    </BarChart>
  );
};

const BarChartCreditedAndProvisionedWithAvgToolTipContent = ({
  active,
  payload,
  aggregatePeriod,
  hideProvisioned = false,
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportResponse["historic"][number];
  }[];
  aggregatePeriod: "month" | "year";
  hideProvisioned?: boolean;
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    const dateValue = aggregatePeriod === "month" ? data.month : data.year;
    const [, month, year] = dateValue?.split("/") ?? [];
    const periodLabel =
      aggregatePeriod === "month" ? `Mês: ${month}/${year}` : `Ano: ${year}`;
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(Colors.brand100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p style={{ color: getColor(Colors.neutral300) }}>{periodLabel}</p>
        <p style={{ color: getColor(Colors.brand200) }}>
          {`Total creditado: R$ ${data.credited.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        {!hideProvisioned && (
          <p style={{ color: getColor(Colors.brand100) }}>
            {`Total provisionado: R$ ${data.provisioned.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
      </Stack>
    );
  }
};

export const BarChartCreditedAndProvisionedWithAvg = ({
  data,
  avg,
  aggregatePeriod,
  chartType,
  responsive = false,
  height = CHART_HEIGHT,
  referenceLabel = "Média",
  referenceStroke,
  showLegend = true,
  creditedFill,
  provisionedFill,
  hideProvisioned = false,
}: {
  data: HistoricReportResponse["historic"];
  avg: number;
  aggregatePeriod: "month" | "year";
  chartType: ChartType;
  responsive?: boolean;
  height?: number;
  referenceLabel?: string;
  referenceStroke?: string;
  showLegend?: boolean;
  creditedFill?: string;
  provisionedFill?: string;
  hideProvisioned?: boolean;
}) => {
  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);

  const { hideValues } = useHideValues();
  const dataKey = aggregatePeriod === "month" ? "month" : "year";
  const tickFormatter =
    aggregatePeriod === "month" ? monthTickerFormatter : yearTickerFormatter;

  const refStroke = referenceStroke ?? getColor(Colors.brand200);
  const creditedFillColor = creditedFill ?? getColor(Colors.brand200);
  const provisionedFillColor = provisionedFill ?? getColor(Colors.neutral900);
  // When a solid provisioned fill is supplied, drop the dashed outline treatment.
  const provisionedExtra = provisionedFill
    ? {}
    : {
        stroke: getColor(Colors.brand100),
        strokeWidth: 1,
        strokeDasharray: "3 3",
      };
  const commonProps = responsive
    ? { data, margin: { left: 5, right: 5 } }
    : {
        width: CHART_WIDTH * 1.15,
        height: CHART_HEIGHT,
        data,
        margin: { left: 25 },
      };

  const xAxisProps = {
    dataKey,
    stroke: getColor(Colors.neutral0),
    tickFormatter,
  };

  const yAxisProps = {
    type: "number" as const,
    stroke: getColor(Colors.neutral0),
    tickFormatter: numberTickFormatter,
    axisLine: false,
    tickLine: false,
    tickCount: hideValues ? 0 : undefined,
  };

  const inner =
    chartType === "line" ? (
      <LineChart {...commonProps}>
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={
            <BarChartCreditedAndProvisionedWithAvgToolTipContent
              aggregatePeriod={aggregatePeriod}
              hideProvisioned={hideProvisioned}
            />
          }
        />
        {showLegend && (
          <Legend verticalAlign="top" content={<LegendContent />} />
        )}
        <Line
          type="monotone"
          dataKey="credited"
          stroke={creditedFillColor}
          strokeWidth={2}
          dot={false}
          name="Creditado"
        />
        {!hideProvisioned && (
          <Line
            type="monotone"
            dataKey="provisioned"
            stroke={provisionedFill ?? getColor(Colors.brand100)}
            strokeWidth={2}
            strokeDasharray={provisionedFill ? undefined : "5 5"}
            dot={false}
            name="Provisionado"
          />
        )}
        <ReferenceLine
          y={avg}
          label={referenceLabel}
          stroke={refStroke}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </LineChart>
    ) : (
      <BarChart {...commonProps}>
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={
            <BarChartCreditedAndProvisionedWithAvgToolTipContent
              aggregatePeriod={aggregatePeriod}
              hideProvisioned={hideProvisioned}
            />
          }
        />
        {showLegend && (
          <Legend verticalAlign="top" content={<LegendContent />} />
        )}
        <Bar
          dataKey="credited"
          stackId="a"
          radius={[5, 5, 0, 0]}
          fill={creditedFillColor}
          name="Creditado"
        />
        {!hideProvisioned && (
          <Bar
            dataKey="provisioned"
            stackId="a"
            radius={[5, 5, 0, 0]}
            fill={provisionedFillColor}
            {...provisionedExtra}
            name="Provisionado"
          />
        )}
        <ReferenceLine
          y={avg}
          label={referenceLabel}
          stroke={refStroke}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </BarChart>
    );

  if (responsive) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        {inner}
      </ResponsiveContainer>
    );
  }
  return inner;
};

import Stack from "@mui/material/Stack";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
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
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportResponse["historic"][number];
  }[];
  aggregatePeriod: "month" | "year";
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
        <p style={{ color: getColor(Colors.brand100) }}>
          {`Total provisionado: R$ ${data.provisioned.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </Stack>
    );
  }
};

export const BarChartCreditedAndProvisionedWithAvg = ({
  data,
  avg,
  aggregatePeriod,
}: {
  data: HistoricReportResponse["historic"];
  avg: number;
  aggregatePeriod: "month" | "year";
}) => {
  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);

  const { hideValues } = useHideValues();
  const dataKey = aggregatePeriod === "month" ? "month" : "year";
  const tickFormatter =
    aggregatePeriod === "month" ? monthTickerFormatter : yearTickerFormatter;

  return (
    <BarChart
      width={CHART_WIDTH * 1.15}
      height={CHART_HEIGHT}
      data={data}
      margin={{ left: 25 }}
    >
      <XAxis
        dataKey={dataKey}
        stroke={getColor(Colors.neutral0)}
        tickFormatter={tickFormatter}
      />
      <YAxis
        type="number"
        stroke={getColor(Colors.neutral0)}
        tickFormatter={numberTickFormatter}
        axisLine={false}
        tickLine={false}
        tickCount={hideValues ? 0 : undefined}
      />
      <Tooltip
        cursor={false}
        content={
          <BarChartCreditedAndProvisionedWithAvgToolTipContent
            aggregatePeriod={aggregatePeriod}
          />
        }
      />
      <Legend verticalAlign="top" content={<LegendContent />} />
      <Bar
        dataKey="credited"
        stackId="a"
        radius={[5, 5, 0, 0]}
        fill={getColor(Colors.brand200)}
        name="Creditado"
      />
      <Bar
        dataKey="provisioned"
        stackId="a"
        radius={[5, 5, 0, 0]}
        fill={getColor(Colors.neutral900)}
        stroke={getColor(Colors.brand100)}
        strokeWidth={1}
        strokeDasharray="3 3"
        name="Provisionado"
      />
      <ReferenceLine
        y={avg}
        label="Média"
        stroke={getColor(Colors.brand200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </BarChart>
  );
};

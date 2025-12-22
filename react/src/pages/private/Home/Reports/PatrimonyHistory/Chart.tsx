import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { ChartType, Colors, getColor } from "../../../../../design-system";
import { roundDown, roundUp, numberTickFormatter } from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";
import { CHART_HEIGHT } from "../consts";

export type PatrimonyDataItem = {
  total: number;
  assets: number;
  bankAccount: number;
  operation_date: string;
};

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TooltipContent = ({
  active,
  payload,
  showBreakdown,
}: {
  active?: boolean;
  payload?: {
    payload: PatrimonyDataItem;
  }[];
  showBreakdown: boolean;
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    const [year, month, day] = data.operation_date.split("-");
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
          {`${day}/${month}/${year}`}
        </p>
        <p style={{ color: getColor(Colors.brand400) }}>
          {`Total: ${formatCurrency(data.total)}`}
        </p>
        {showBreakdown && (
          <>
            <p style={{ color: getColor(Colors.brand200) }}>
              {`Investimentos: ${formatCurrency(data.assets)}`}
            </p>
            <p style={{ color: getColor(Colors.brand100) }}>
              {`Conta bancária: ${formatCurrency(data.bankAccount)}`}
            </p>
          </>
        )}
      </Stack>
    );
  }
};

const xAxisTickFormatter = (value: string, index: number) => {
  if (!index) return "";
  if (value === "agora") return value;
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const legendFormatter = (value: string) => {
  const labels: Record<string, string> = {
    total: "Total",
    assets: "Investimentos",
    bankAccount: "Conta bancária",
  };
  return labels[value] ?? value;
};

type ChartProps = {
  data: PatrimonyDataItem[];
  isLoading: boolean;
  showBreakdown: boolean;
  chartType: ChartType;
};

const Chart = ({ data, isLoading, showBreakdown, chartType }: ChartProps) => {
  const { hideValues } = useHideValues();

  if (isLoading)
    return (
      <Skeleton variant="rounded" width="100%" height={CHART_HEIGHT} />
    );

  const commonProps = {
    data,
    margin: { top: 20, right: 5, left: 5 },
  };

  const xAxisProps = {
    dataKey: "operation_date",
    stroke: getColor(Colors.neutral0),
    tickLine: false,
    tickFormatter: xAxisTickFormatter,
  };

  const yAxisProps = {
    tickLine: false,
    stroke: getColor(Colors.neutral0),
    tickFormatter: numberTickFormatter,
    type: "number" as const,
    domain: ([dataMin, dataMax]: [number, number]): [number, number] => [
      roundDown(dataMin),
      roundUp(dataMax),
    ],
    axisLine: false,
    tickCount: hideValues ? 0 : undefined,
  };

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="5" vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={<TooltipContent showBreakdown={showBreakdown} />}
        />
        {showBreakdown && (
          <Legend
            wrapperStyle={{ color: getColor(Colors.neutral0) }}
            formatter={legendFormatter}
          />
        )}
        <Line
          type="bump"
          dataKey="total"
          stroke={getColor(Colors.brand400)}
          strokeWidth={3}
          dot={false}
        />
        {showBreakdown && (
          <>
            <Line
              type="bump"
              dataKey="assets"
              stroke={getColor(Colors.brand200)}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="bump"
              dataKey="bankAccount"
              stroke={getColor(Colors.brand100)}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </>
        )}
      </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
    <BarChart {...commonProps}>
      <CartesianGrid strokeDasharray="5" vertical={false} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip
        cursor={false}
        content={<TooltipContent showBreakdown={showBreakdown} />}
      />
      {showBreakdown && (
        <Legend
          wrapperStyle={{ color: getColor(Colors.neutral0) }}
          formatter={legendFormatter}
        />
      )}
      {showBreakdown ? (
        <>
          <Bar
            dataKey="assets"
            stackId="a"
            fill={getColor(Colors.brand200)}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="bankAccount"
            stackId="a"
            fill={getColor(Colors.brand100)}
            radius={[5, 5, 0, 0]}
          />
        </>
      ) : (
        <Bar
          dataKey="total"
          fill={getColor(Colors.brand400)}
          radius={[5, 5, 0, 0]}
        />
      )}
    </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;

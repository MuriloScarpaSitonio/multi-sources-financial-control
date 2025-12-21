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
} from "recharts";

import { ChartType, Colors, getColor } from "../../../../../design-system";
import { roundDown, roundUp, numberTickFormatter } from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";

const CHART_WIDTH = 660;
const CHART_HEIGHT = 385;

const TooltipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: {
      total: number;
      operation_date: string;
    };
  }[];
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    const [year, month, day] = data.operation_date.split("-");
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(Colors.brand400),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p style={{ color: getColor(Colors.brand400) }}>
          {`${day}/${month}/${year}`}
        </p>
        <p style={{ color: getColor(Colors.brand400) }}>
          {`R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </Stack>
    );
  }
};

type DataItem =
  | {
      invested_total: number;
      bank_amount_total: number;
      operation_date: string;
    }
  | {
      total: number;
      operation_date: string;
    };

const xAxisTickFormatter = (value: string, index: number) => {
  if (!index) return "";
  if (value === "agora") return value;
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const Chart = ({
  data,
  isLoading,
  dataKey = "total",
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
  chartType = "line",
}: {
  data: DataItem[] | undefined;
  isLoading: boolean;
  dataKey?: string;
  width?: number;
  height?: number;
  chartType?: ChartType;
}) => {
  const { hideValues } = useHideValues();

  if (isLoading)
    return <Skeleton variant="rounded" width={width} height={height} />;

  const commonProps = {
    width,
    height,
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
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="5" vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip cursor={false} content={<TooltipContent />} />
        <Line
          type="bump"
          dataKey={dataKey}
          stroke={getColor(Colors.brand300)}
          strokeWidth={3.5}
          dot={false}
        />
      </LineChart>
    );
  }

  return (
    <BarChart {...commonProps}>
      <CartesianGrid strokeDasharray="5" vertical={false} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip cursor={false} content={<TooltipContent />} />
      <Bar
        dataKey={dataKey}
        fill={getColor(Colors.brand300)}
        radius={[5, 5, 0, 0]}
      />
    </BarChart>
  );
};

export default Chart;

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { Colors, getColor } from "../../../../../design-system";
import { roundDown, roundUp, numberTickFormatter } from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";

const CHART_WIDTH = 550;
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

const Chart = ({
  data,
  isLoading,
  dataKey = "total",
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
}: {
  data: DataItem[] | undefined;
  isLoading: boolean;
  dataKey?: string;
  width?: number;
  height?: number;
}) => {
  const { hideValues } = useHideValues();

  if (isLoading)
    return <Skeleton variant="rounded" width={width} height={height} />;

  return (
    <LineChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 20, right: 5, left: 5 }}
    >
      <CartesianGrid strokeDasharray="5" vertical={false} />
      <XAxis
        dataKey="operation_date"
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
        tickFormatter={(value, index) => {
          if (!index) return "";
          if (value === "agora") return value;
          const [year, month] = value.split("-");
          return `${month}/${year}`;
        }}
      />
      <YAxis
        tickLine={false}
        stroke={getColor(Colors.neutral0)}
        tickFormatter={numberTickFormatter}
        type="number"
        domain={([dataMin, dataMax]) => [roundDown(dataMin), roundUp(dataMax)]}
        axisLine={false}
        tickCount={hideValues ? 0 : undefined}
      />
      <Tooltip cursor={false} content={<TooltipContent />} />
      <Line
        type="bump"
        dataKey={dataKey}
        stroke={getColor(Colors.brand300)}
        strokeWidth={3.5}
      />
    </LineChart>
  );
};

export default Chart;

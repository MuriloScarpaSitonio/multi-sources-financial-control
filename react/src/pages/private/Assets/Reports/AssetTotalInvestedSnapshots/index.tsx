import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import { startOfMonth, subYears } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { useAssetsTotalInvestedHistory } from "./hooks";
import { Colors, getColor } from "../../../../../design-system";
import { useAssetsIndicators } from "../../Indicators/hooks";
import { useMemo } from "react";

const roundDown = (value: number) => {
  if (value < 100_000) return Math.floor(value / 10_000) * 10_000;
  else if (value < 1_000_000) return Math.floor(value / 100_000) * 100_000;
  else return Math.floor(value / 500_000) * 500_000;
};

const roundUp = (value: number) => {
  if (value < 100_000) return Math.ceil(value / 10_000) * 10_000;
  else if (value < 1_000_000) return Math.ceil(value / 100_000) * 100_000;
  else return Math.ceil(value / 500_000) * 500_000;
};

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
  if (active && payload && payload.length) {
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

const Chart = ({
  data,
}: {
  data: { total: number; operation_date: string }[] | undefined;
}) => {
  return (
    <LineChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      data={data}
      margin={{ top: 20, right: 5 }}
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
        tickFormatter={(value) => {
          if (value >= 1_000_000)
            return (
              "R$ " + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
            );
          else if (value >= 1000)
            return "R$ " + (value / 1000).toFixed(1).replace(/\.0$/, "") + "k";
          else return "R$ " + value.toString();
        }}
        type="number"
        domain={([dataMin, dataMax]) => [roundDown(dataMin), roundUp(dataMax)]}
        axisLine={false}
      />
      <Tooltip cursor={false} content={<TooltipContent />} />
      <Line
        type="bump"
        dataKey="total"
        stroke={getColor(Colors.brand300)}
        strokeWidth={3.5}
      />
    </LineChart>
  );
};

const AssetTotalInvestedSnapshots = () => {
  const now = new Date();
  const firstDayOfMonth = startOfMonth(now);
  const {
    data,
    // isPending TODO
  } = useAssetsTotalInvestedHistory({
    start_date: subYears(firstDayOfMonth, 1),
    end_date: firstDayOfMonth,
  });

  // this may trigger a race condition as we are querying this endpoint
  // in another component
  // TODO: consider calling once in the parent component and pass it to the
  // childrens
  const { data: { total } = {} } = useAssetsIndicators();
  const chartData = useMemo(
    () => [
      ...(data ?? []),
      ...(total
        ? [{ total, operation_date: now.toISOString().slice(0, 10) }]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, total],
  );
  return (
    <Box
      sx={{
        backgroundColor: getColor(Colors.neutral900),
        borderRadius: 6, // 24px
        p: 2,
      }}
    >
      <Chart data={chartData} />
    </Box>
  );
};

export default AssetTotalInvestedSnapshots;

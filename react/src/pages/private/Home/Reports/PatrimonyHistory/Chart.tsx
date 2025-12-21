import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { Colors, getColor } from "../../../../../design-system";
import { roundDown, roundUp, numberTickFormatter } from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";
import { CHART_HEIGHT, CHART_WIDTH } from "../consts";

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

const Chart = ({
  data,
  isLoading,
  showBreakdown,
}: {
  data: PatrimonyDataItem[];
  isLoading: boolean;
  showBreakdown: boolean;
}) => {
  const { hideValues } = useHideValues();

  if (isLoading)
    return (
      <Skeleton variant="rounded" width={CHART_WIDTH} height={CHART_HEIGHT} />
    );

  return (
    <LineChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
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
      <Tooltip
        cursor={false}
        content={<TooltipContent showBreakdown={showBreakdown} />}
      />
      {showBreakdown && (
        <Legend
          wrapperStyle={{ color: getColor(Colors.neutral0) }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              total: "Total",
              assets: "Investimentos",
              bankAccount: "Conta bancária",
            };
            return labels[value] ?? value;
          }}
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
  );
};

export default Chart;


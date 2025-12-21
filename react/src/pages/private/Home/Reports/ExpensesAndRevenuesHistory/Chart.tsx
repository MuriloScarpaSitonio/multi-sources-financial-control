import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";

import {
  BarChart,
  LineChart,
  Bar,
  Line,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartType, Colors, getColor } from "../../../../../design-system";
import { RawDateString } from "../../../../../types";
import { CHART_HEIGHT, CHART_WIDTH } from "../consts";
import {
  numberTickFormatter,
  monthTickerFormatter,
  yearTickerFormatter,
  roundDown,
  roundUp,
} from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";

type DataItem = {
  expenses: number;
  revenues: number;
  diff: number;
  month?: RawDateString;
  year?: RawDateString;
};

type Data = {
  historic: DataItem[];
  avg: {
    expenses: number;
    revenues: number;
  };
};

type AggregatePeriod = "month" | "year";

const ToolTipContent = ({
  active,
  payload,
  aggregatePeriod,
}: {
  active?: boolean;
  payload?: {
    payload: DataItem;
  }[];
  aggregatePeriod: AggregatePeriod;
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    const dateLabel =
      aggregatePeriod === "month"
        ? `Mês: ${data.month?.split("/")[1]}/${data.month?.split("/")[2]}`
        : `Ano: ${data.year?.split("/")[2]}`;
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(Colors.danger100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        {!!data.revenues && (
          <p
            style={{
              color: getColor(Colors.brand200),
            }}
          >
            {`Receitas: R$ ${data.revenues.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {!!data.expenses && (
          <p
            style={{
              color: getColor(Colors.danger200),
            }}
          >
            {`Despesas: R$ ${data.expenses.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {!!data.expenses && !!data.revenues && (
          <p
            style={{
              color: getColor(Colors.neutral200),
            }}
          >
            {`Diferença: R$ ${data.diff.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        <p
          style={{
            color: getColor(Colors.neutral300),
          }}
        >
          {dateLabel}
        </p>
      </Stack>
    );
  }
};

const Chart = ({
  data,
  isLoading,
  aggregatePeriod,
  chartType,
}: {
  data: Data;
  isLoading: boolean;
  aggregatePeriod: AggregatePeriod;
  chartType: ChartType;
}) => {
  const { hideValues } = useHideValues();

  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);

  const dataKey = aggregatePeriod === "month" ? "month" : "year";
  const tickFormatter =
    aggregatePeriod === "month" ? monthTickerFormatter : yearTickerFormatter;

  const isFutureDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/");
    return (
      new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) >
      secondDayOfCurrentMonth
    );
  };

  if (isLoading)
    return (
      <Skeleton variant="rounded" width={CHART_WIDTH} height={CHART_HEIGHT} />
    );

  const commonProps = {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    data: data.historic,
    margin: { top: 20, right: 5, left: 5 },
  };

  const xAxisProps = {
    dataKey,
    stroke: getColor(Colors.neutral0),
    tickFormatter,
  };

  const yAxisProps = {
    stroke: getColor(Colors.neutral0),
    tickFormatter: numberTickFormatter,
    type: "number" as const,
    domain: ([dataMin, dataMax]: [number, number]): [number, number] => [
      roundDown(dataMin),
      roundUp(dataMax),
    ],
    axisLine: false,
    tickLine: false,
    tickCount: hideValues ? 0 : undefined,
  };

  if (chartType === "line") {
    return (
      <LineChart {...commonProps}>
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={<ToolTipContent aggregatePeriod={aggregatePeriod} />}
        />
        <Line
          type="monotone"
          dataKey="revenues"
          stroke={getColor(Colors.brand200)}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke={getColor(Colors.danger200)}
          strokeWidth={2}
          dot={false}
        />
        <ReferenceLine
          y={data.avg.expenses}
          label="Média despesas"
          stroke={getColor(Colors.danger200)}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <ReferenceLine
          y={data.avg.revenues}
          label="Média receitas"
          stroke={getColor(Colors.brand200)}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </LineChart>
    );
  }

  return (
    <BarChart {...commonProps} stackOffset="sign">
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip
        cursor={false}
        content={<ToolTipContent aggregatePeriod={aggregatePeriod} />}
      />
      <Bar dataKey="revenues" stackId="a" radius={[5, 5, 0, 0]}>
        {data.historic.map((d) => {
          const dateStr = d.month ?? d.year ?? "";
          const isFuture = isFutureDate(dateStr);

          const props = isFuture
            ? {
                fill: getColor(Colors.neutral900),
                strokeWidth: 1,
                stroke: getColor(Colors.brand100),
                strokeDasharray: "3 3",
              }
            : {
                fill: getColor(Colors.brand200),
              };
          return <Cell key={dateStr} {...props} />;
        })}
      </Bar>
      <Bar dataKey="expenses" stackId="a" radius={[5, 5, 0, 0]}>
        {data.historic.map((d) => {
          const dateStr = d.month ?? d.year ?? "";
          const isFuture = isFutureDate(dateStr);

          const props = isFuture
            ? {
                fill: getColor(Colors.neutral900),
                strokeWidth: 1,
                stroke: getColor(Colors.danger100),
                strokeDasharray: "3 3",
              }
            : {
                fill: getColor(Colors.danger200),
              };
          return <Cell key={dateStr} {...props} />;
        })}
      </Bar>
      <ReferenceLine
        y={data.avg.expenses}
        label="Média despesas"
        stroke={getColor(Colors.danger200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <ReferenceLine
        y={data.avg.revenues}
        label="Média receitas"
        stroke={getColor(Colors.brand200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </BarChart>
  );
};

export default Chart;

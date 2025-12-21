import Stack from "@mui/material/Stack";

import {
  BarChart,
  LineChart,
  Bar,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartType, Colors, getColor } from "../../../../design-system";
import { HistoricReportResponse } from "../types";
import {
  monthTickerFormatter,
  numberTickFormatter,
  yearTickerFormatter,
} from "../../utils";
import { useHideValues } from "../../../../hooks/useHideValues";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;

const ToolTipContent = ({
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
          borderColor: getColor(Colors.danger100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        {!!data.total_bought && (
          <p
            style={{
              color: getColor(Colors.brand200),
            }}
          >
            {`Compras: R$ ${data.total_bought.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {!!data.total_sold && (
          <p
            style={{
              color: getColor(Colors.danger200),
            }}
          >
            {`Vendas: R$ ${data.total_sold.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {!!data.total_sold && !!data.total_bought && (
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
          {periodLabel}
        </p>
      </Stack>
    );
  }
};

const PositiveNegativeBarChart = ({
  data,
  aggregatePeriod,
  chartType,
}: {
  data: HistoricReportResponse["historic"];
  aggregatePeriod: "month" | "year";
  chartType: ChartType;
}) => {
  const { hideValues } = useHideValues();
  const dataKey = aggregatePeriod === "month" ? "month" : "year";
  const tickFormatter =
    aggregatePeriod === "month" ? monthTickerFormatter : yearTickerFormatter;

  const commonProps = {
    width: CHART_WIDTH * 1.5,
    height: CHART_HEIGHT,
    data,
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

  if (chartType === "line") {
    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="5" vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={<ToolTipContent aggregatePeriod={aggregatePeriod} />}
        />
        <Line
          type="monotone"
          dataKey="total_bought"
          stroke={getColor(Colors.brand200)}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="total_sold"
          stroke={getColor(Colors.danger200)}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    );
  }

  return (
    <BarChart {...commonProps} stackOffset="sign">
      <CartesianGrid strokeDasharray="5" vertical={false} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip
        cursor={false}
        content={<ToolTipContent aggregatePeriod={aggregatePeriod} />}
      />
      <Bar
        dataKey="total_bought"
        stackId="a"
        fill={getColor(Colors.brand200)}
        radius={[5, 5, 0, 0]}
      />
      <Bar
        dataKey="total_sold"
        stackId="a"
        fill={getColor(Colors.danger200)}
        radius={[5, 5, 0, 0]}
      />
    </BarChart>
  );
};

export default PositiveNegativeBarChart;

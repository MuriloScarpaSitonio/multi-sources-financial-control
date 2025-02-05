import Stack from "@mui/material/Stack";

import { BarChart, Bar, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { getColor, Colors } from "../../../../design-system";
import { GroupBy, ReportUnknownAggregationData } from "../types";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;
const BAR_CHART_SIZE = 40;
const ADEQUATE_NUMBER_OF_BARS = 5;

const getBarSize = ({ numOfBars }: { numOfBars: number }) =>
  numOfBars < ADEQUATE_NUMBER_OF_BARS ? BAR_CHART_SIZE : BAR_CHART_SIZE / 2;

const getChartHeigtMultiplier = ({ numOfBars }: { numOfBars: number }) =>
  // for every bar above threshold add .05; fallback to 1 if less than threshold
  1 + Math.max((numOfBars - ADEQUATE_NUMBER_OF_BARS) / 10, 0);

const HorizontalStackedBarChartToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: {
      total: number;
      avg: number;
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const { payload: data } = payload[0];
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
        <p style={{ color: getColor(Colors.danger200) }}>
          {`Atual: R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p style={{ color: getColor(Colors.danger100) }}>
          {`Média: R$ ${data.avg.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </Stack>
    );
  }
};

export const HorizontalStackedBarChart = ({
  data,
  groupBy,
}: {
  data: ReportUnknownAggregationData;
  groupBy: GroupBy;
}) => {
  const numOfBars = data?.length ?? 0;
  return (
    <BarChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT * getChartHeigtMultiplier({ numOfBars })}
      data={data}
      layout="vertical"
      margin={{ left: 55 }}
    >
      <XAxis
        type="number"
        tickFormatter={(t) => `R$ ${t.toLocaleString("pt-br")}`}
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey={groupBy}
        yAxisId={0}
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
      />
      <YAxis type="category" dataKey={groupBy} yAxisId={1} hide />
      <Tooltip
        cursor={false}
        content={<HorizontalStackedBarChartToolTipContent />}
      />
      <Legend
        formatter={(value) => (value === "avg" ? "Média" : "Mês atual")}
      />
      <Bar
        dataKey="avg"
        barSize={getBarSize({ numOfBars })}
        yAxisId={0}
        fill={getColor(Colors.danger100)}
      />
      <Bar
        dataKey="total"
        barSize={getBarSize({ numOfBars }) / 2}
        yAxisId={1}
        fill={getColor(Colors.danger200)}
      />
    </BarChart>
  );
};

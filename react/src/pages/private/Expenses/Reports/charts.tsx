import Stack from "@mui/material/Stack";

import {
  BarChart,
  Bar,
  Legend,
  Pie,
  PieChart as PieReChart,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { getColor, Colors } from "../../../../design-system";
import { ExpenseOptionsProperties } from "../consts";
import {
  GroupBy,
  ReportUnknownAggregationData,
  HistoricReportDataItem,
} from "../types";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300;
const BAR_CHART_SIZE = 40;
const ADEQUATE_NUMBER_OF_BARS = 5;

const getBarSize = ({ numOfBars }: { numOfBars: number }) =>
  numOfBars < ADEQUATE_NUMBER_OF_BARS ? BAR_CHART_SIZE : BAR_CHART_SIZE / 2;

const getChartHeigtMultiplier = ({ numOfBars }: { numOfBars: number }) =>
  // for every bar above threshold add .05; fallback to 1 if less than threshold
  1 + Math.max((numOfBars - ADEQUATE_NUMBER_OF_BARS) / 10, 0);

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
  name,
  fill,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  value: number;
  name: keyof typeof ExpenseOptionsProperties;
  fill: string;
}) => {
  const RADIAN = Math.PI / 180;
  const radius = 25 + innerRadius + (outerRadius - innerRadius);
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <>
      <text
        x={x}
        y={y}
        fill={fill}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {name}
      </text>
      <text
        x={x}
        y={y + 15}
        fill={getColor(Colors.neutral200)}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {value.toLocaleString("pt-br", { minimumFractionDigits: 2 })}%
      </text>
    </>
  );
};

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

export const PieChart = ({
  data,
  groupBy,
}: {
  data: ReportUnknownAggregationData;
  groupBy: GroupBy;
}) => {
  const hasFewOptions = (data?.length ?? 0) < 5;
  return (
    <PieReChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT * 1.1}
      margin={{ right: 100 }}
    >
      {!hasFewOptions && (
        <Legend
          payload={data?.map((item) => {
            const label = item[
              groupBy
            ] as keyof typeof ExpenseOptionsProperties;
            const { color } = ExpenseOptionsProperties[label];
            return {
              value: label,
              color,
            };
          })}
        />
      )}
      <Pie
        data={data}
        dataKey="total"
        nameKey={groupBy}
        cx="50%"
        cy="50%"
        innerRadius={70}
        outerRadius={100}
        label={
          hasFewOptions
            ? renderCustomizedLabel
            : (l) => `${l.payload.total.toLocaleString("pt-br")}%`
        }
        labelLine={false}
        stroke="none"
        paddingAngle={2}
        minAngle={2}
      >
        {data?.map((item) => {
          const label = item[groupBy] as keyof typeof ExpenseOptionsProperties;
          return (
            <Cell
              key={`expenses-percentage-pie-chart-cell-${label}`}
              fill={ExpenseOptionsProperties[label].color}
            />
          );
        })}
      </Pie>
    </PieReChart>
  );
};

const BarChartWithReferenceLineToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportDataItem;
  }[];
}) => {
  if (active && payload && payload.length) {
    const { payload: data } = payload[0];
    const [_, month, year] = data.month.split("/");
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
          {`Total: R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p style={{ color: getColor(Colors.danger100) }}>
          {`Mês: ${month}/${year}`}
        </p>
      </Stack>
    );
  }
};

export const BarChartWithReferenceLine = ({
  data,
  referenceValue,
}: {
  data: HistoricReportDataItem[];
  referenceValue: number;
}) => {
  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);
  return (
    <BarChart
      width={CHART_WIDTH * 1.2}
      height={CHART_HEIGHT}
      data={data}
      margin={{ left: 55 }}
    >
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip
        cursor={false}
        content={<BarChartWithReferenceLineToolTipContent />}
      />
      <Bar dataKey="total" radius={[5, 5, 0, 0]}>
        {data?.map((d) => {
          const [day, month, year] = d.month.split("/");
          const isFuture =
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) >
            secondDayOfCurrentMonth;
          const props = isFuture
            ? {
                fill: getColor(Colors.neutral900),
                strokeWidth: 1,
                stroke: getColor(Colors.danger100),
                strokeDasharray: "3 3",
              }
            : { fill: getColor(Colors.danger200) };
          return <Cell key={d.month} {...props} />;
        })}
      </Bar>
      <ReferenceLine
        y={referenceValue}
        label="Média"
        stroke={getColor(Colors.danger200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </BarChart>
  );
};

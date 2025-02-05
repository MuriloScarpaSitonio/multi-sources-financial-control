import type { ReactNode } from "react";

import Stack from "@mui/material/Stack";

import { Cell, Legend, Pie, PieChart as PieReChart } from "recharts";

import Text from "../Text";
import { getColor } from "../../utils";
import { Colors } from "../../enums";
import { Skeleton } from "@mui/material";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300;

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
  name: string;
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

const ChartBox = ({ children }: { children: ReactNode }) => (
  <Stack
    sx={{
      justifyContent: "center",
      alignItems: "center",
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
    }}
  >
    {children}
  </Stack>
);

const PieChart = ({
  data,
  groupBy,
  noDataText,
  colorPredicate,
  cellPrefix,
  isLoading,
  cx = "50%",
  cy = "50%",
  dataKey = "total",
  innerRadius = 70,
  outerRadius = 100,
}: {
  data: any[];
  groupBy: string;
  noDataText: string;
  colorPredicate: (label: string) => string;
  cellPrefix: string;
  isLoading: boolean;
  cx?: string;
  cy?: string;
  dataKey?: string;
  innerRadius?: number;
  outerRadius?: number;
}) => {
  if (isLoading)
    return (
      <ChartBox>
        <Skeleton
          height={CHART_HEIGHT / 1.3}
          width={CHART_HEIGHT / 1.3}
          variant="circular"
        />
      </ChartBox>
    );
  if (data.length === 0)
    return (
      <ChartBox>
        <Text>{noDataText}</Text>
      </ChartBox>
    );

  const hasFewOptions = data.length < 5;
  return (
    <PieReChart width={CHART_WIDTH} height={CHART_HEIGHT}>
      {!hasFewOptions && (
        <Legend
          payload={data?.map((item) => {
            const label = item[groupBy];
            return { value: label, color: colorPredicate(label) };
          })}
        />
      )}
      <Pie
        data={data}
        dataKey={dataKey}
        nameKey={groupBy}
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
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
          const label = item[groupBy];
          return (
            <Cell key={`${cellPrefix}-${label}`} fill={colorPredicate(label)} />
          );
        })}
      </Pie>
    </PieReChart>
  );
};

export default PieChart;

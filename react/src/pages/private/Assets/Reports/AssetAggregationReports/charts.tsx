import type { ReactNode, ReactElement } from "react";
import type { LayoutType, Margin } from "recharts/types/util/types";
import type {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../../consts";
import type { ReportUnknownAggregationData } from "../types";

import { Children } from "react";

import {
  Bar,
  BarChart as BarReChart,
  Cell,
  Legend,
  Pie,
  PieChart as PieReChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Colors, getColor } from "../../../../../design-system";
import { AssetOptionsProperties } from "../../consts";
import { GroupBy } from "../types";

const CHART_WIDTH = 1200;
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
  name: keyof typeof AssetOptionsProperties;
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

const ReportHorizontalBarChartTooltip = ({
  active,
  payload,
  positiveNegativeColor,
}: {
  positiveNegativeColor?: boolean;
  active?: boolean;
  payload?: {
    payload: {
      total: number;
      type: keyof typeof AssetsTypesMapping;
      sector: keyof typeof AssetsSectorsMapping;
      objective: keyof typeof AssetsObjectivesMapping;
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const { payload: data } = payload[0];
    const color = positiveNegativeColor
      ? data.total > 0
        ? getColor(Colors.brand)
        : getColor(Colors.danger200)
      : AssetOptionsProperties[data.type ?? data.sector ?? data.objective]
          .color;
    return (
      <p style={{ color }}>
        {`R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2 })}`}
      </p>
    );
  }

  return null;
};

export const BarChart = ({
  children,
  width,
  height,
  barSize,
  data,
  dataKey,
  margin,
  layout = "vertical",
  positiveNegativeTooltipColor = false,
}: {
  children?: ReactNode;
  width: number;
  height: number;
  barSize: number;
  data: any[];
  dataKey: string;
  margin?: Margin;
  layout?: LayoutType;
  positiveNegativeTooltipColor?: boolean;
}) => {
  const cells: ReactElement[] = [];
  const others: ReactElement[] = [];
  Children.forEach(children, (child) => {
    const c = child?.valueOf() as { type?: ReactNode };
    const childName = (c?.type?.valueOf() as { name?: string })?.name;
    if (childName === "Cell") cells.push(child as ReactElement);
    else others.push(child as ReactElement);
  });
  return (
    <BarReChart
      width={width}
      height={height}
      data={data}
      layout={layout}
      margin={margin}
    >
      <XAxis
        type="number"
        tickFormatter={(t) => `R$ ${t.toLocaleString("pt-br")}`}
        stroke={getColor(Colors.neutral0)}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey={dataKey}
        tickLine={false}
        stroke={getColor(Colors.neutral0)}
      />
      <Tooltip
        cursor={false}
        content={
          <ReportHorizontalBarChartTooltip
            positiveNegativeColor={positiveNegativeTooltipColor}
          />
        }
      />
      {others}
      <Bar
        dataKey="total"
        barSize={barSize}
        fill={getColor(Colors.brand)}
        radius={[0, 5, 5, 0]}
      >
        {cells}
      </Bar>
    </BarReChart>
  );
};

export const HorizontalPositiveNegativeBarChart = ({
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
      dataKey={groupBy}
      margin={{ left: 55 }}
      barSize={getBarSize({ numOfBars })}
      positiveNegativeTooltipColor
    >
      <ReferenceLine x={0} stroke={getColor(Colors.neutral0)} />
      {data?.map((d) => (
        <Cell
          key={`assets-roi-report-bar-chart-cell-${d[groupBy]}`}
          fill={
            d.total > 0 ? getColor(Colors.brand) : getColor(Colors.danger200)
          }
        />
      ))}
    </BarChart>
  );
};

export const HorizontalBarChart = ({
  data,
  groupBy,
}: {
  data: ReportUnknownAggregationData;
  groupBy: GroupBy;
}) => {
  const numOfBars = data?.length ?? 0;
  return (
    <BarChart
      width={CHART_WIDTH - 15}
      height={CHART_HEIGHT * getChartHeigtMultiplier({ numOfBars })}
      data={data}
      margin={{ left: 30 }}
      dataKey={groupBy}
      barSize={getBarSize({ numOfBars })}
    >
      {data?.map((item) => {
        const label = item[groupBy] as keyof typeof AssetOptionsProperties;
        return (
          <Cell
            key={`assets-total-invested-report-bar-chart-cell-${label}`}
            fill={AssetOptionsProperties[label].color}
          />
        );
      })}
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
  const hasFewOptions = groupBy === GroupBy.OBJECTIVE;
  return (
    <PieReChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      margin={{ right: 100 }}
    >
      {!hasFewOptions && (
        <Legend
          payload={data?.map((item) => {
            const label = item[groupBy] as keyof typeof AssetOptionsProperties;
            const { color } = AssetOptionsProperties[label];
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
      >
        {data?.map((item) => {
          const label = item[groupBy] as keyof typeof AssetOptionsProperties;
          return (
            <Cell
              key={`assets-total-invested-report-pie-chart-cell-${label}`}
              fill={AssetOptionsProperties[label].color}
            />
          );
        })}
      </Pie>
    </PieReChart>
  );
};

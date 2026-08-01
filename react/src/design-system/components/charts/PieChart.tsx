import { useEffect, useState, type ReactNode } from "react";

import Stack from "@mui/material/Stack";

import { Cell, Legend, Pie, PieChart as PieReChart } from "recharts";

import Text from "../Text";
import { getColor } from "../../utils";
import { Colors } from "../../enums";
import { Skeleton } from "@mui/material";

const CHART_WIDTH = 700;
const INACTIVE_OPACITY = 0.3;
const HIGHLIGHT_TRANSITION = "opacity 150ms ease";

const getPieItemHighlight = (
  itemIndex: number,
  activeIndex: number | null,
) => ({
  isActive: itemIndex === activeIndex,
  opacity:
    activeIndex === null || itemIndex === activeIndex ? 1 : INACTIVE_OPACITY,
});

const getActivePieItemIndex = (
  data: any[],
  groupBy: string,
  activeLabel: string | null,
) => {
  if (activeLabel === null) return null;

  const activeIndex = data.findIndex(
    (item) => String(item[groupBy]) === activeLabel,
  );
  return activeIndex === -1 ? null : activeIndex;
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  value,
  name,
  fill,
  index = 0,
  activeIndex,
  onActivate,
  onDeactivate,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  value: number;
  name: string;
  fill: string;
  index?: number;
  activeIndex: number | null;
  onActivate: (index: number) => void;
  onDeactivate: () => void;
}) => {
  const RADIAN = Math.PI / 180;
  const radius = 25 + innerRadius + (outerRadius - innerRadius);
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const { isActive, opacity } = getPieItemHighlight(index, activeIndex);

  return (
    <g
      opacity={opacity}
      style={{ cursor: "pointer", transition: HIGHLIGHT_TRANSITION }}
      onMouseEnter={() => onActivate(index)}
      onMouseLeave={onDeactivate}
    >
      <text
        x={x}
        y={y}
        fill={fill}
        fontWeight={isActive ? 600 : 400}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {name}
      </text>
      <text
        x={x}
        y={y + 15}
        fill={getColor(Colors.neutral200)}
        fontWeight={isActive ? 600 : 400}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {value.toLocaleString("pt-br", { minimumFractionDigits: 2 })}%
      </text>
    </g>
  );
};

const renderPercentageLabel = ({
  x,
  y,
  value,
  fill,
  textAnchor,
  index = 0,
  activeIndex,
  onActivate,
  onDeactivate,
}: {
  x: number;
  y: number;
  value: number;
  fill: string;
  textAnchor: "start" | "middle" | "end";
  index?: number;
  activeIndex: number | null;
  onActivate: (index: number) => void;
  onDeactivate: () => void;
}) => {
  const { isActive, opacity } = getPieItemHighlight(index, activeIndex);

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      opacity={opacity}
      fontWeight={isActive ? 600 : 400}
      textAnchor={textAnchor}
      dominantBaseline="central"
      style={{ cursor: "pointer", transition: HIGHLIGHT_TRANSITION }}
      onMouseEnter={() => onActivate(index)}
      onMouseLeave={onDeactivate}
    >
      {value.toLocaleString("pt-br")}%
    </text>
  );
};

const ChartBox = ({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) => (
  <Stack
    sx={{
      justifyContent: "center",
      alignItems: "center",
      width: CHART_WIDTH,
      height,
    }}
  >
    {children}
  </Stack>
);

const PieChartLegend = ({
  data,
  groupBy,
  colorPredicate,
  cellPrefix,
  activeIndex,
  onActivate,
  onDeactivate,
}: {
  data: any[];
  groupBy: string;
  colorPredicate: (label: string) => string;
  cellPrefix: string;
  activeIndex: number | null;
  onActivate: (index: number) => void;
  onDeactivate: () => void;
}) => (
  <ul
    className="recharts-default-legend"
    style={{ margin: 0, padding: 0, textAlign: "center" }}
  >
    {data.map((item, index) => {
      const label = item[groupBy];
      const color = colorPredicate(label);
      const { isActive, opacity } = getPieItemHighlight(index, activeIndex);

      return (
        <li
          key={`${cellPrefix}-legend-${label}`}
          className={`recharts-legend-item legend-item-${index}`}
          style={{
            cursor: "pointer",
            display: "inline-block",
            marginRight: 10,
            opacity,
            transition: HIGHLIGHT_TRANSITION,
          }}
          onMouseEnter={() => onActivate(index)}
          onMouseLeave={onDeactivate}
        >
          <span
            aria-hidden="true"
            style={{
              backgroundColor: color,
              borderRadius: 2,
              display: "inline-block",
              height: 14,
              marginRight: 4,
              verticalAlign: "middle",
              width: 14,
            }}
          />
          <span
            className="recharts-legend-item-text"
            style={{
              color,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {label}
          </span>
        </li>
      );
    })}
  </ul>
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
  height = 300,
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
  height?: number;
}) => {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dataFingerprint = JSON.stringify(data.map((item) => item[groupBy]));
  const activeIndex = getActivePieItemIndex(data, groupBy, activeLabel);
  const activate = (index: number) => {
    setHasInteracted(true);
    const label = data[index]?.[groupBy];
    setActiveLabel(label == null ? null : String(label));
  };
  const deactivate = () => setActiveLabel(null);

  useEffect(() => {
    setActiveLabel(null);
  }, [dataFingerprint, groupBy, isLoading]);

  if (isLoading)
    return (
      <ChartBox height={height}>
        <Skeleton
          height={height / 1.3}
          width={height / 1.3}
          variant="circular"
        />
      </ChartBox>
    );
  if (data.length === 0)
    return (
      <ChartBox height={height}>
        <Text>{noDataText}</Text>
      </ChartBox>
    );

  const hasFewOptions = data.length < 5;

  return (
    <PieReChart width={CHART_WIDTH} height={height}>
      {!hasFewOptions && (
        <Legend
          content={
            <PieChartLegend
              data={data}
              groupBy={groupBy}
              colorPredicate={colorPredicate}
              cellPrefix={cellPrefix}
              activeIndex={activeIndex}
              onActivate={activate}
              onDeactivate={deactivate}
            />
          }
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
            ? (props) =>
                renderCustomizedLabel({
                  ...props,
                  activeIndex,
                  onActivate: activate,
                  onDeactivate: deactivate,
                })
            : (props) =>
                renderPercentageLabel({
                  ...props,
                  activeIndex,
                  onActivate: activate,
                  onDeactivate: deactivate,
                })
        }
        labelLine={false}
        stroke="none"
        paddingAngle={2}
        minAngle={2}
        isAnimationActive={!hasInteracted}
        onMouseEnter={(_, index) => activate(index)}
        onMouseLeave={deactivate}
      >
        {data?.map((item, index) => {
          const label = item[groupBy];
          const fill = colorPredicate(label);
          const { isActive, opacity } = getPieItemHighlight(index, activeIndex);

          return (
            <Cell
              key={`${cellPrefix}-${label}`}
              fill={fill}
              opacity={opacity}
              stroke={isActive ? getColor(Colors.neutral0) : "none"}
              strokeWidth={isActive ? 2 : 0}
              style={{ cursor: "pointer", transition: HIGHLIGHT_TRANSITION }}
            />
          );
        })}
      </Pie>
    </PieReChart>
  );
};

export default PieChart;

import Stack from "@mui/material/Stack";

import {
  Bar,
  BarChart,
  LineChart,
  Line,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHideValues } from "../../../hooks/useHideValues";
import {
  monthTickerFormatter,
  numberTickFormatter,
  yearTickerFormatter,
} from "../../../pages/private/utils";
import { RawDateString } from "../../../types";
import { Colors } from "../../enums";
import { getColor } from "../../utils";
import { ChartType } from "../ChartTypeToggle";

type HistoricReportDataItem = {
  total: number;
  month?: RawDateString;
  year?: RawDateString;
};

const CHART_WIDTH = 825;
const CHART_HEIGHT = 300;

const BarChartWithReferenceLineToolTipContent = ({
  active,
  payload,
  variant,
  aggregatePeriod,
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportDataItem;
  }[];
  variant: "danger" | "success";
  aggregatePeriod: "month" | "year";
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, month, year] = ((data.month ?? data.year) as RawDateString).split(
      "/"
    );
    const isVariantDanger = variant === "danger";
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(
            isVariantDanger ? Colors.danger100 : Colors.brand100
          ),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p
          style={{
            color: getColor(
              isVariantDanger ? Colors.danger200 : Colors.brand200
            ),
          }}
        >
          {`Total: R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p
          style={{
            color: getColor(
              isVariantDanger ? Colors.danger100 : Colors.brand100
            ),
          }}
        >
          {`${aggregatePeriod === "month" ? "Mês" : "Ano"}: ${aggregatePeriod === "month" ? `${month}/${year}` : year
            }`}
        </p>
      </Stack>
    );
  }
};

const getFillAndStrokeColor = ({
  isVariantDanger,
  isPositive,
}: {
  isVariantDanger: boolean;
  isPositive: boolean;
}) => {
  if (isVariantDanger) {
    if (isPositive) return [Colors.danger200, Colors.danger100];
    return [Colors.brand200, Colors.brand100];
  }
  if (isPositive) return [Colors.brand200, Colors.brand100];
  return [Colors.danger200, Colors.danger100];
};

const BarChartWithReferenceLine = ({
  data,
  referenceValue,
  variant,
  aggregatePeriod,
  chartType = "bar",
}: {
  data: HistoricReportDataItem[];
  referenceValue: number;
  variant: "danger" | "success";
  aggregatePeriod: "month" | "year";
  chartType?: ChartType;
}) => {
  const { hideValues } = useHideValues();

  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);
  const isVariantDanger = variant === "danger";

  const commonProps = {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    data,
    margin: { left: 25 },
  };

  const xAxisProps = {
    dataKey: aggregatePeriod,
    stroke: getColor(Colors.neutral0),
    tickFormatter:
      aggregatePeriod === "month" ? monthTickerFormatter : yearTickerFormatter,
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
    const strokeColor = isVariantDanger ? Colors.danger200 : Colors.brand200;
    return (
      <LineChart {...commonProps}>
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip
          cursor={false}
          content={
            <BarChartWithReferenceLineToolTipContent
              variant={variant}
              aggregatePeriod={aggregatePeriod}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke={getColor(strokeColor)}
          strokeWidth={2}
          dot={false}
        />
        <ReferenceLine
          y={referenceValue}
          label="Média"
          stroke={getColor(strokeColor)}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </LineChart>
    );
  }

  return (
    <BarChart {...commonProps}>
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip
        cursor={false}
        content={
          <BarChartWithReferenceLineToolTipContent
            variant={variant}
            aggregatePeriod={aggregatePeriod}
          />
        }
      />
      <Bar dataKey="total" radius={[5, 5, 0, 0]}>
        {data?.map((d) => {
          const [day, month, year] = ((d.month ?? d.year) as RawDateString).split(
            "/"
          );
          const isFuture =
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) >
            secondDayOfCurrentMonth;
          const [fillColor, strokeColor] = getFillAndStrokeColor({
            isVariantDanger,
            isPositive: d.total > 0,
          });
          const props = isFuture
            ? {
              fill: getColor(Colors.neutral900),
              strokeWidth: 1,
              stroke: getColor(strokeColor),
              strokeDasharray: "3 3",
            }
            : {
              fill: getColor(fillColor),
            };
          return <Cell key={d.month} {...props} />;
        })}
      </Bar>
      <ReferenceLine
        y={referenceValue}
        label="Média"
        stroke={getColor(isVariantDanger ? Colors.danger200 : Colors.brand200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </BarChart>
  );
};

export default BarChartWithReferenceLine;

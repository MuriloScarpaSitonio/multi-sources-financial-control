import Stack from "@mui/material/Stack";

import {
  BarChart,
  Bar,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Colors } from "../../enums";
import { RawDateString } from "../../../types";
import { getColor } from "../../utils";
import {
  monthTickerFormatter,
  numberTickFormatter,
} from "../../../pages/private/utils";
import { useHideValues } from "../../../hooks/useHideValues";

type HistoricReportDataItem = {
  total: number;
  month: RawDateString;
};

const CHART_WIDTH = 825;
const CHART_HEIGHT = 300;

const BarChartWithReferenceLineToolTipContent = ({
  active,
  payload,
  variant,
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportDataItem;
  }[];
  variant: "danger" | "success";
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, month, year] = data.month.split("/");
    const isVariantDanger = variant === "danger";
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(
            isVariantDanger ? Colors.danger100 : Colors.brand100,
          ),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p
          style={{
            color: getColor(
              isVariantDanger ? Colors.danger200 : Colors.brand200,
            ),
          }}
        >
          {`Total: R$ ${data.total.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p
          style={{
            color: getColor(
              isVariantDanger ? Colors.danger100 : Colors.brand100,
            ),
          }}
        >
          {`Mês: ${month}/${year}`}
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
}: {
  data: HistoricReportDataItem[];
  referenceValue: number;
  variant: "danger" | "success";
}) => {
  const { hideValues } = useHideValues();

  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);
  const isVariantDanger = variant === "danger";

  return (
    <BarChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      data={data}
      margin={{ left: 25 }}
    >
      <XAxis
        dataKey="month"
        stroke={getColor(Colors.neutral0)}
        tickFormatter={monthTickerFormatter}
      />
      <YAxis
        type="number"
        stroke={getColor(Colors.neutral0)}
        tickFormatter={numberTickFormatter}
        axisLine={false}
        tickLine={false}
        tickCount={hideValues ? 0 : undefined}
      />
      <Tooltip
        cursor={false}
        content={<BarChartWithReferenceLineToolTipContent variant={variant} />}
      />
      <Bar dataKey="total" radius={[5, 5, 0, 0]}>
        {data?.map((d) => {
          const [day, month, year] = d.month.split("/");
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

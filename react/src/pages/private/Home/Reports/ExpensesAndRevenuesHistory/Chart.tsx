import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";

import {
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Colors, getColor } from "../../../../../design-system";
import { RawDateString } from "../../../../../types";
import { CHART_HEIGHT, CHART_WIDTH } from "../consts";
import {
  numberTickFormatter,
  monthTickerFormatter,
  roundDown,
  roundUp,
} from "../../../utils";
import { useHideValues } from "../../../../../hooks/useHideValues";

type DataItem = {
  expenses: number;
  revenues: number;
  diff: number;
  month: RawDateString;
};

type Data = {
  historic: DataItem[];
  avg: {
    expenses: number;
    revenues: number;
  };
};

const ToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: DataItem;
  }[];
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          {`Mês: ${month}/${year}`}
        </p>
      </Stack>
    );
  }
};

const Chart = ({ data, isLoading }: { data: Data; isLoading: boolean }) => {
  const { hideValues } = useHideValues();

  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);

  if (isLoading)
    return (
      <Skeleton variant="rounded" width={CHART_WIDTH} height={CHART_HEIGHT} />
    );
  return (
    <BarChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      stackOffset="sign"
      data={data.historic}
      margin={{ top: 20, right: 5, left: 5 }}
    >
      <XAxis
        dataKey="month"
        stroke={getColor(Colors.neutral0)}
        tickFormatter={monthTickerFormatter}
      />
      <YAxis
        stroke={getColor(Colors.neutral0)}
        tickFormatter={numberTickFormatter}
        type="number"
        domain={([dataMin, dataMax]) => [roundDown(dataMin), roundUp(dataMax)]}
        axisLine={false}
        tickLine={false}
        tickCount={hideValues ? 0 : undefined}
      />
      <Tooltip cursor={false} content={<ToolTipContent />} />
      <Bar dataKey="revenues" stackId="a" radius={[5, 5, 0, 0]}>
        {data.historic.map((d) => {
          const [day, month, year] = d.month.split("/");
          const isFuture =
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) >
            secondDayOfCurrentMonth;

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
          return <Cell key={d.month} {...props} />;
        })}
      </Bar>
      <Bar dataKey="expenses" stackId="a" radius={[5, 5, 0, 0]}>
        {data.historic.map((d) => {
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
            : {
                fill: getColor(Colors.danger200),
              };
          return <Cell key={d.month} {...props} />;
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

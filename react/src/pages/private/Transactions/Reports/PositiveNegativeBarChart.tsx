import Stack from "@mui/material/Stack";

import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Colors, getColor } from "../../../../design-system";
import { HistoricReportResponse } from "../types";
import { monthTickerFormatter, numberTickFormatter } from "../../utils";
import { useHideValues } from "../../../../hooks/useHideValues";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;

const ToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: HistoricReportResponse["historic"][number];
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
          {`Mês: ${month}/${year}`}
        </p>
      </Stack>
    );
  }
};

const PositiveNegativeBarChart = ({
  data,
}: {
  data: HistoricReportResponse["historic"];
}) => {
  const { hideValues } = useHideValues();

  return (
    <BarChart
      width={CHART_WIDTH * 1.5}
      height={CHART_HEIGHT}
      stackOffset="sign"
      data={data}
    >
      <CartesianGrid strokeDasharray="5" vertical={false} />
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
      <Tooltip cursor={false} content={<ToolTipContent />} />
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

import Stack from "@mui/material/Stack";

import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Colors,
  FontSizes,
  getColor,
  Text,
  StatusDot,
} from "../../../../design-system";
import { HistoricReportResponse, TopAssetsResponse } from "../types";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300 * 1.25;

const LegendContent = (props?: {
  payload?: {
    payload?: {
      dataKey: string;
      stroke: string;
      strokeDasharray: string;
      fill: string;
      name: string;
    };
  }[];
}) => {
  const [first, second] = props?.payload ?? [];
  return (
    <Stack
      direction="row"
      gap={2}
      alignSelf="center"
      justifyContent="center"
      marginTop={0.5}
      marginBottom={1.5}
    >
      <Stack direction="row" gap={0.5} alignItems="center">
        <StatusDot
          variant="custom"
          color={first?.payload?.fill}
          stroke={first?.payload?.stroke}
          strokeDasharray={first?.payload?.strokeDasharray ? "2 2" : undefined}
        />
        <Text colors={Colors.neutral300} size={FontSizes.SMALL}>
          {first?.payload?.name}
        </Text>
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center">
        <StatusDot
          variant="custom"
          color={second?.payload?.fill}
          stroke={second?.payload?.stroke}
          strokeDasharray={second?.payload?.strokeDasharray ? "2 2" : undefined}
        />
        <Text colors={Colors.neutral300} size={FontSizes.SMALL}>
          {second?.payload?.name}
        </Text>
      </Stack>
    </Stack>
  );
};

const HorizontalBarChartToolTipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: TopAssetsResponse[number];
  }[];
}) => {
  if (active && payload?.length) {
    const { payload: data } = payload[0];
    return (
      <Stack
        spacing={0.1}
        sx={{
          border: "1px solid",
          p: 1,
          borderColor: getColor(Colors.brand100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p style={{ color: getColor(Colors.neutral300) }}>
          {`Ativo: ${data.code}`}
        </p>
        {data.credited > 0 && (
          <p style={{ color: getColor(Colors.brand200) }}>
            {`Total creditado: R$ ${data.credited.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {data.provisioned > 0 && (
          <p style={{ color: getColor(Colors.brand100) }}>
            {`Total provisionado: R$ ${data.provisioned.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
      </Stack>
    );
  }
};

export const HorizontalBarChart = ({ data }: { data: TopAssetsResponse }) => (
  <BarChart
    width={CHART_WIDTH}
    height={CHART_HEIGHT}
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
      dataKey="code"
      stroke={getColor(Colors.neutral0)}
      tickLine={false}
    />
    <Tooltip cursor={false} content={<HorizontalBarChartToolTipContent />} />
    <Legend verticalAlign="top" content={<LegendContent />} />
    <Bar
      dataKey="credited"
      stackId="a"
      radius={[0, 5, 5, 0]}
      fill={getColor(Colors.brand200)}
      name="Creditado"
    />
    <Bar
      dataKey="provisioned"
      stackId="a"
      radius={[0, 5, 5, 0]}
      fill={getColor(Colors.neutral900)}
      stroke={getColor(Colors.brand100)}
      strokeWidth={1}
      strokeDasharray="3 3"
      name="Provisionado"
    />
  </BarChart>
);

const BarChartCreditedAndProvisionedWithAvgToolTipContent = ({
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
          borderColor: getColor(Colors.brand100),
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <p style={{ color: getColor(Colors.neutral300) }}>
          {`Mês: ${month}/${year}`}
        </p>
        {data.credited > 0 && (
          <p style={{ color: getColor(Colors.brand200) }}>
            {`Total creditado: R$ ${data.credited.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
        {data.provisioned > 0 && (
          <p style={{ color: getColor(Colors.brand100) }}>
            {`Total provisionado: R$ ${data.provisioned.toLocaleString("pt-br", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        )}
      </Stack>
    );
  }
};

export const BarChartCreditedAndProvisionedWithAvg = ({
  data,
  avg,
}: {
  data: HistoricReportResponse["historic"];
  avg: number;
}) => {
  const secondDayOfCurrentMonth = new Date();
  secondDayOfCurrentMonth.setDate(2);
  return (
    <BarChart
      width={CHART_WIDTH * 1.15}
      height={CHART_HEIGHT}
      data={data}
      margin={{ left: 25 }}
    >
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip
        cursor={false}
        content={<BarChartCreditedAndProvisionedWithAvgToolTipContent />}
      />
      <Legend verticalAlign="top" content={<LegendContent />} />
      <Bar
        dataKey="credited"
        stackId="a"
        radius={[5, 5, 0, 0]}
        fill={getColor(Colors.brand200)}
        name="Creditado"
      />
      <Bar
        dataKey="provisioned"
        stackId="a"
        radius={[5, 5, 0, 0]}
        fill={getColor(Colors.neutral900)}
        stroke={getColor(Colors.brand100)}
        strokeWidth={1}
        strokeDasharray="3 3"
        name="Provisionado"
      />
      <ReferenceLine
        y={avg}
        label="Média"
        stroke={getColor(Colors.brand200)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </BarChart>
  );
};

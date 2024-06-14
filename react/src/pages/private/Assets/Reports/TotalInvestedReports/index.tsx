import type { MouseEvent } from "react";
import { useState } from "react";

import { Cell, Legend, Pie, PieChart as PieReChart } from "recharts";

import { Colors, getColor } from "../../../../../design-system";
import { AssetOptionsProperties } from "../../consts";
import { ReportCard, BarChart } from "../components";
import { Tab, TabPanel, Tabs, TabsList } from "./layout";
import { useTotalInvestedReports } from "./hooks";

// section: consts
const CHART_WIDTH = 600;
const CHART_HEIGHT = 300;
const BAR_CHART_SIZE = 40;

const PERCENTAGE_REPORT_TEXT = "Percentual";
const TOTAL_AMOUNT_REPORT_TEXT = "Montante investido";
const PERCENTAGE_REPORT_TEXT_CURRENT = "Percentual (atual)";
const TOTAL_AMOUNT_REPORT_TEXT_CURRENT = "Montante investido (atual)";

const FILTERS = {
  [PERCENTAGE_REPORT_TEXT]: {
    percentage: true,
    current: false,
  },
  [TOTAL_AMOUNT_REPORT_TEXT]: {
    percentage: false,
    current: false,
  },
  [PERCENTAGE_REPORT_TEXT_CURRENT]: {
    percentage: true,
    current: true,
  },
  [TOTAL_AMOUNT_REPORT_TEXT_CURRENT]: {
    percentage: false,
    current: true,
  },
};
// end section: consts

// section: types
type MenuButtonTexts =
  | typeof PERCENTAGE_REPORT_TEXT
  | typeof TOTAL_AMOUNT_REPORT_TEXT
  | typeof PERCENTAGE_REPORT_TEXT_CURRENT
  | typeof TOTAL_AMOUNT_REPORT_TEXT_CURRENT;

type TotalInvestDataItem = {
  total: number;
  type?: string;
  objective?: string;
};
type TotalInvestAggregateByTypeDataItem = TotalInvestDataItem & {
  type:
    | "Ação EUA"
    | "Ação B3"
    | "Criptoativos"
    | "Fundo de Investimento Imobiliário";
};
type TotalInvestAggregateByObjectiveDataItem = TotalInvestDataItem & {
  objective: "Crescimento" | "Dividendo";
};
type TotalInvestAggregateBySectorDataItem = TotalInvestDataItem & {
  sector:
    | "Bens industriais"
    | "Comunicações"
    | "Consumo não cíclico"
    | "Consumo cíclico"
    | "Financeiro"
    | "Materiais básicos"
    | "Petróleo, gás e biocombustíveis"
    | "Saúde"
    | "Tecnologia"
    | "Utilidade pública"
    | "Desconhecido";
};

type GroupBy = "type" | "sector" | "objective";
// end section: types

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

  const { display } = AssetOptionsProperties[name];
  return (
    <>
      <text
        x={x}
        y={y}
        fill={fill}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
      >
        {display ?? name}
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

const HorizontalBarChart = ({
  data,
  groupBy,
}: {
  data:
    | TotalInvestAggregateByTypeDataItem[]
    | TotalInvestAggregateByObjectiveDataItem[]
    | TotalInvestAggregateBySectorDataItem[];
  groupBy: GroupBy;
}) => (
  <BarChart
    width={CHART_WIDTH - 15}
    height={CHART_HEIGHT}
    data={data}
    margin={{ left: 30 }}
    dataKey={groupBy}
    barSize={groupBy === "sector" ? BAR_CHART_SIZE / 2 : BAR_CHART_SIZE}
  >
    {data?.map((item) => {
      const label = (item as TotalInvestAggregateBySectorDataItem)[
        groupBy
      ] as keyof typeof AssetOptionsProperties;
      return (
        <Cell
          key={`assets-total-invested-report-bar-chart-cell-${label}`}
          fill={AssetOptionsProperties[label].color}
        />
      );
    })}
  </BarChart>
);

const PieChart = ({
  data,
  groupBy,
}: {
  data:
    | TotalInvestAggregateByTypeDataItem[]
    | TotalInvestAggregateByObjectiveDataItem[]
    | TotalInvestAggregateBySectorDataItem[];
  groupBy: GroupBy;
}) => {
  const hasFewOptions = groupBy === "objective";
  return (
    <PieReChart
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      margin={{ right: 100 }}
    >
      {!hasFewOptions && <Legend />}
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
          const label = (item as TotalInvestAggregateBySectorDataItem)[
            groupBy
          ] as keyof typeof AssetOptionsProperties;
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

const TotalInvestedReports = () => {
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [menuButtonText, setMenuButtonText] = useState<MenuButtonTexts>(
    PERCENTAGE_REPORT_TEXT,
  );
  const [menuItems, setMenuItems] = useState<MenuButtonTexts[]>([
    TOTAL_AMOUNT_REPORT_TEXT,
    PERCENTAGE_REPORT_TEXT_CURRENT,
    TOTAL_AMOUNT_REPORT_TEXT_CURRENT,
  ]);

  const handleMenuClick = (event: MouseEvent<HTMLLIElement>, index: number) => {
    const newItems = [...menuItems];
    newItems.splice(index, 1);
    setMenuItems([...newItems, menuButtonText]);
    setMenuButtonText(
      (event.target as HTMLLIElement).innerText as MenuButtonTexts,
    );
  };

  const params = { ...FILTERS[menuButtonText], group_by: groupBy };
  const {
    data,
    // isPending TODO
  } = useTotalInvestedReports(params);

  return (
    <ReportCard
      menuButtonText={menuButtonText}
      handleMenuClick={handleMenuClick}
      menuItems={menuItems}
    >
      <Tabs
        defaultValue={0}
        orientation="vertical"
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setGroupBy("type");
              break;
            case 1:
              setGroupBy("sector");
              break;
            case 2:
              setGroupBy("objective");
              break;
            default:
              break;
          }
        }}
      >
        <TabsList>
          <Tab>Por tipo</Tab>
          <Tab>Por setor</Tab>
          <Tab>Por objetivo</Tab>
        </TabsList>
        <TabPanel value={0}>
          {params.percentage ? (
            <PieChart
              data={data as TotalInvestAggregateByTypeDataItem[]}
              groupBy="type"
            />
          ) : (
            <HorizontalBarChart
              data={data as TotalInvestAggregateByTypeDataItem[]}
              groupBy="type"
            />
          )}
        </TabPanel>
        <TabPanel value={1}>
          {params.percentage ? (
            <PieChart
              data={data as TotalInvestAggregateBySectorDataItem[]}
              groupBy="sector"
            />
          ) : (
            <HorizontalBarChart
              data={data as TotalInvestAggregateBySectorDataItem[]}
              groupBy="sector"
            />
          )}
        </TabPanel>
        <TabPanel value={2}>
          {params.percentage ? (
            <PieChart
              data={data as TotalInvestAggregateByObjectiveDataItem[]}
              groupBy="objective"
            />
          ) : (
            <HorizontalBarChart
              data={data as TotalInvestAggregateByObjectiveDataItem[]}
              groupBy="objective"
            />
          )}
        </TabPanel>
      </Tabs>
    </ReportCard>
  );
};

export default TotalInvestedReports;

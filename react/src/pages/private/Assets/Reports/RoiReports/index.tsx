import type { MouseEvent } from "react";

import { useState } from "react";

import { Cell, ReferenceLine } from "recharts";

import { Colors, getColor } from "../../../../../design-system";
import { ReportCard, BarChart } from "../components";
import { useRoiReport } from "./hooks";

const CHART_WIDTH = 700;
const CHART_HEIGHT = 300;
const BAR_CHART_SIZE = 40;
// const MAX_TICK_ADDER = 10_000;

const ALL_REPORT_TEXT = "Tudo";
const OPENED_REPORT_TEXT = "Abertos";
const CLOSED_REPORT_TEXT = "Fechados";

const FILTERS = {
  [ALL_REPORT_TEXT]: {
    opened: true,
    closed: true,
  },
  [OPENED_REPORT_TEXT]: {
    opened: true,
    closed: false,
  },
  [CLOSED_REPORT_TEXT]: {
    opened: false,
    closed: true,
  },
};

type MenuButtonTexts =
  | typeof ALL_REPORT_TEXT
  | typeof OPENED_REPORT_TEXT
  | typeof CLOSED_REPORT_TEXT;

type RoiReportDataItem = {
  total: number;
  type:
    | "Ação EUA"
    | "Ação B3"
    | "Criptoativos"
    | "Fundo de Investimento Imobiliário";
};

const HorizontalBarChart = ({ data }: { data: RoiReportDataItem[] }) => (
  <BarChart
    width={CHART_WIDTH}
    height={CHART_HEIGHT}
    data={data}
    dataKey="type"
    margin={{ left: 35 }}
    barSize={BAR_CHART_SIZE}
    positiveNegativeTooltipColor
  >
    <ReferenceLine x={0} stroke={getColor(Colors.neutral0)} />
    {data?.map((d) => (
      <Cell
        key={`assets-roi-report-bar-chart-cell-${d.type}`}
        fill={d.total > 0 ? getColor(Colors.brand) : getColor(Colors.danger200)}
      />
    ))}
  </BarChart>
);

const RoiReports = () => {
  const [menuButtonText, setMenuButtonText] =
    useState<MenuButtonTexts>(ALL_REPORT_TEXT);
  const [menuItems, setMenuItems] = useState<MenuButtonTexts[]>([
    OPENED_REPORT_TEXT,
    CLOSED_REPORT_TEXT,
  ]);

  const handleMenuClick = (event: MouseEvent<HTMLLIElement>, index: number) => {
    const newItems = [...menuItems];
    newItems.splice(index, 1);
    setMenuItems([...newItems, menuButtonText]);
    setMenuButtonText(
      (event.target as HTMLLIElement).innerText as MenuButtonTexts,
    );
  };

  // const maxTick = useMemo(() => {
  //   if (!data) return 0;
  //   return (
  //     Math.ceil(Math.max(...data.map((d) => d.total)) / MAX_TICK_ADDER) *
  //     MAX_TICK_ADDER
  //   );
  // }, [data]);

  const {
    data,
    // isPending TODO
  } = useRoiReport(FILTERS[menuButtonText]);

  return (
    <ReportCard
      menuButtonText={menuButtonText}
      handleMenuClick={handleMenuClick}
      menuItems={menuItems}
    >
      <HorizontalBarChart data={data as RoiReportDataItem[]} />
    </ReportCard>
  );
};

export default RoiReports;

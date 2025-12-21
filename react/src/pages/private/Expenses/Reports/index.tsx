import { useCallback, useContext, useMemo, useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";

import {
  ChartType,
  ChartTypeToggle,
  DatePickers,
  StyledTab,
  StyledTabs,
  StyledTabsList,
  ReportBox,
  Text,
  FontSizes,
  BarChartWithReferenceLine,
  PieChart,
} from "../../../../design-system";
import {
  GroupBy,
  AvgComparasionPeriods,
  Kinds,
  ReportUnknownAggregationData,
  HistoricReportResponse,
} from "../types";
import { HorizontalStackedBarChart } from "./charts";
import {
  useExpensesAvgComparasionReport,
  useExpensesPercentagenReport,
  useExpensesHistoricReport,
} from "./hooks";
import ReportTabs from "../../../../design-system/components/ReportTabs";
import { ExpensesContext } from "../context";
import { ExpensesTypesColorMap } from "../consts";
import { useHistoricDateState } from "../../hooks";

const PercentageContent = ({ groupBy }: { groupBy: GroupBy }) => {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sources: { hexColorMapping: sourcesColorMapping },
    categories: { hexColorMapping: categoriesColorMapping },
  } = useContext(ExpensesContext);

  const colors = useMemo(() => {
    if (groupBy === GroupBy.SOURCE) return sourcesColorMapping;
    if (groupBy === GroupBy.CATEGORY) return categoriesColorMapping;
    return ExpensesTypesColorMap;
  }, [categoriesColorMapping, groupBy, sourcesColorMapping]);

  const colorsPredicate = useCallback(
    (label: string) => colors.get(label) as string,
    [colors]
  );

  const { data, isPending } = useExpensesPercentagenReport({
    groupBy,
    startDate,
    endDate,
  });

  return (
    <Stack justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <DatePickers
        views={["day", "month", "year"]}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
      <PieChart
        data={data ?? []}
        isLoading={isPending}
        groupBy={groupBy}
        noDataText="Nenhuma despesa encontrada"
        colorPredicate={colorsPredicate}
        cellPrefix="expenses-pie-chart-cell"
      />
    </Stack>
  );
};

const CurrentWithAvgComparasionContent = ({
  groupBy,
}: {
  groupBy: GroupBy;
}) => {
  const [period, setPeriod] =
    useState<AvgComparasionPeriods>("since_a_year_ago");
  const {
    data,
    // isPending TODO
  } = useExpensesAvgComparasionReport({ groupBy, period });

  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="flex-end"
      >
        <Text size={FontSizes.SEMI_REGULAR}>Comparar com média de</Text>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as AvgComparasionPeriods)}
        >
          <MenuItem value="since_a_year_ago">Um ano atrás</MenuItem>
          <MenuItem value="current_month_and_past">Todo o período</MenuItem>
        </Select>
      </Stack>
      <HorizontalStackedBarChart
        data={data as ReportUnknownAggregationData}
        groupBy={groupBy}
      />
    </Stack>
  );
};

const GroupByTabsContent = ({
  groupBy,
  kind,
}: {
  groupBy: GroupBy;
  kind: Kinds;
}) => {
  if (kind === Kinds.PERCENTAGE) return <PercentageContent groupBy={groupBy} />;

  return <CurrentWithAvgComparasionContent groupBy={groupBy} />;
};

const GroupByTabsWithContent = ({ kind }: { kind: Kinds }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.CATEGORY);
  return (
    <StyledTabs
      defaultValue={0}
      onChange={(_, newValue) => {
        switch (newValue) {
          case 0:
            setGroupBy(GroupBy.CATEGORY);
            break;
          case 1:
            setGroupBy(GroupBy.SOURCE);
            break;
          case 2:
            setGroupBy(GroupBy.TYPE);
            break;
          default:
            break;
        }
      }}
    >
      <StyledTabsList>
        <StyledTab>Categorias</StyledTab>
        <StyledTab>Fontes</StyledTab>
        <StyledTab>Tipos</StyledTab>
      </StyledTabsList>
      <TabPanel value={0}>
        <GroupByTabsContent groupBy={groupBy} kind={kind} />
      </TabPanel>
      <TabPanel value={1}>
        <GroupByTabsContent groupBy={groupBy} kind={kind} />
      </TabPanel>
      <TabPanel value={2}>
        <GroupByTabsContent groupBy={groupBy} kind={kind} />
      </TabPanel>
    </StyledTabs>
  );
};

const HistoricContent = () => {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [oneYearAgo, threeMonthsInTheFuture] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    const _threeMonthsInTheFuture = new Date();
    _threeMonthsInTheFuture.setMonth(_threeMonthsInTheFuture.getMonth() + 4);
    return [_oneYearAgo, _threeMonthsInTheFuture];
  }, []);

  const {
    startDate,
    endDate,
    aggregatePeriod,
    handleAggregatePeriodChange,
    handleStartDateChange,
    handleEndDateChange,
  } = useHistoricDateState({
    initialStartDate: oneYearAgo,
    initialEndDate: threeMonthsInTheFuture,
  });

  const {
    data,
    // isPending TODO
  } = useExpensesHistoricReport({
    startDate,
    endDate,
    aggregatePeriod,
  });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-around"
      >
        <Stack direction="row" gap={2} alignItems="center">
          <ChartTypeToggle value={chartType} onChange={setChartType} />
          <Stack direction="row" gap={1} alignItems="center">
            <Text size={FontSizes.SEMI_REGULAR}>Agregar por</Text>
            <Select
              value={aggregatePeriod}
              onChange={(e) =>
                handleAggregatePeriodChange(e.target.value as "month" | "year")
              }
            >
              <MenuItem value="month">Mês</MenuItem>
              <MenuItem value="year">Ano</MenuItem>
            </Select>
          </Stack>
        </Stack>
        <DatePickers
          views={aggregatePeriod === "month" ? ["month", "year"] : ["year"]}
          startDate={startDate}
          setStartDate={handleStartDateChange}
          endDate={endDate}
          setEndDate={handleEndDateChange}
        />
      </Stack>
      <BarChartWithReferenceLine
        data={data?.historic as HistoricReportResponse["historic"]}
        referenceValue={data?.avg as HistoricReportResponse["avg"]}
        variant="danger"
        aggregatePeriod={aggregatePeriod}
        chartType={chartType}
      />
    </Stack>
  );
};

const Content = ({ kind }: { kind: Kinds }) => {
  if (kind === Kinds.HISTORIC) return <HistoricContent />;
  return <GroupByTabsWithContent kind={kind} />;
};

const ExpenseReports = () => {
  const [kind, setKind] = useState<Kinds>(Kinds.PERCENTAGE);
  const [tabValue, setTabValue] = useState(0);

  return (
    <ReportBox>
      <ReportTabs
        value={tabValue}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setKind(Kinds.PERCENTAGE);
              setTabValue(newValue);
              break;
            case 1:
              setKind(Kinds.HISTORIC);
              setTabValue(newValue);
              break;
            case 2:
              setKind(Kinds.TOTAL_SPENT);
              setTabValue(newValue);
              break;
            default:
              break;
          }
        }}
      >
        <Tab label="Percentual" />
        <Tab label="Histórico" />
        <Tab label="Valor gasto" />
      </ReportTabs>
      <Content kind={kind} />
    </ReportBox>
  );
};

export default ExpenseReports;

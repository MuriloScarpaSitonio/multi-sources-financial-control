import { useContext, useMemo, useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

import {
  StyledTab,
  StyledTabs,
  StyledTabsList,
  ReportBox,
} from "../../../../design-system";
import {
  GroupBy,
  AvgComparasionPeriods,
  Kinds,
  PercentagePeriods,
  ReportUnknownAggregationData,
  HistoricReportResponse,
} from "../types";
import {
  HorizontalStackedBarChart,
  PieChart,
  BarChartWithReferenceLine,
} from "./charts";
import {
  useExpensesAvgComparasionReport,
  useExpensesPercentagenReport,
  useExpensesHistoricReport,
} from "./hooks";
import ReportTabs from "../../../../design-system/components/ReportTabs";
import { ExpensesContext } from "../context";
import { ExpensesTypesColorMap } from "../consts";

const PercentageContent = ({ groupBy }: { groupBy: GroupBy }) => {
  const [period, setPeriod] = useState<PercentagePeriods>("current");
  const {
    sources: { hexColorMapping: sourcesColorMapping },
    categories: { hexColorMapping: categoriesColorMapping },
  } = useContext(ExpensesContext);

  const colors =
    groupBy === GroupBy.SOURCE
      ? sourcesColorMapping
      : groupBy === GroupBy.CATEGORY
        ? categoriesColorMapping
        : ExpensesTypesColorMap;

  const {
    data,
    // isPending TODO
  } = useExpensesPercentagenReport({
    group_by: groupBy,
    period,
  });

  return (
    <Stack justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PercentagePeriods)}
        >
          <MenuItem value="current">Mês atual</MenuItem>
          <MenuItem value="since_a_year_ago">Um ano atrás</MenuItem>
          <MenuItem value="current_month_and_past">Todo o período</MenuItem>
        </Select>
      </Stack>
      <PieChart
        data={data as ReportUnknownAggregationData}
        groupBy={groupBy}
        colors={colors}
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
  } = useExpensesAvgComparasionReport({
    group_by: groupBy,
    period,
  });

  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
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
  const [oneYearAgo, threeMonthsInTheFuture] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    const _threeMonthsInTheFuture = new Date();
    _threeMonthsInTheFuture.setMonth(_threeMonthsInTheFuture.getMonth() + 4);
    return [_oneYearAgo, _threeMonthsInTheFuture];
  }, []);

  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(threeMonthsInTheFuture);
  const {
    data,
    // isPending TODO
  } = useExpensesHistoricReport({
    start_date: startDate,
    end_date: endDate,
  });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ pr: 2.5 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
          <DatePicker
            label="Início"
            slotProps={{
              textField: { required: true, size: "small", variant: "standard" },
            }}
            value={startDate}
            views={["month", "year"]}
            onChange={(v) => {
              if (v && v < endDate) setStartDate(v);
            }}
          />
        </LocalizationProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
          <DatePicker
            label="Fim"
            slotProps={{
              textField: { required: true, size: "small", variant: "standard" },
            }}
            value={endDate}
            views={["month", "year"]}
            onChange={(v) => {
              if (v && v > startDate) setEndDate(v);
            }}
          />
        </LocalizationProvider>
      </Stack>
      <BarChartWithReferenceLine
        data={data?.historic as HistoricReportResponse["historic"]}
        referenceValue={data?.avg as HistoricReportResponse["avg"]}
      />
    </Stack>
  );
};

const Content = ({ kind }: { kind: Kinds }) => {
  if (kind === Kinds.HISTORIC) return <HistoricContent />;
  return <GroupByTabsWithContent kind={kind} />;
};

const ExpenseReports = () => {
  const [kind, setKind] = useState<Kinds>(Kinds.HISTORIC);
  const [tabValue, setTabValue] = useState(0);

  return (
    <ReportBox>
      <ReportTabs
        value={tabValue}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setKind(Kinds.HISTORIC);
              setTabValue(newValue);
              break;
            case 1:
              setKind(Kinds.PERCENTAGE);
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
        <Tab label="Histórico" />
        <Tab label="Percentual" />
        <Tab label="Valor gasto" />
      </ReportTabs>
      <Content kind={kind} />
    </ReportBox>
  );
};

export default ExpenseReports;

import { useCallback, useContext, useMemo, useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";

import {
  BarChartWithReferenceLine,
  DatePickers,
  FontSizes,
  PieChart,
  ReportBox,
  ReportTabs,
  StyledTab,
  StyledTabs,
  StyledTabsList,
  Text,
} from "../../../../design-system";
import { GroupBy, HistoricReportResponse } from "../../Expenses/types";
import {
  useRevenuesHistoricReport,
  useRevenuesPercentagenReport,
} from "./hooks";
import { ExpensesContext } from "../../Expenses/context";
import { MenuItem, Select } from "@mui/material";
import { useHistoricDateState } from "../../hooks";

enum Kinds {
  PERCENTAGE,
  HISTORIC,
}

const HistoricContent = () => {
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
  } = useRevenuesHistoricReport({
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
        variant="success"
        aggregatePeriod={aggregatePeriod}
      />
    </Stack>
  );
};
const PercentageContent = () => {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    revenuesCategories: { hexColorMapping: colors },
  } = useContext(ExpensesContext);

  const { data, isPending } = useRevenuesPercentagenReport({
    startDate,
    endDate,
  });

  const colorsPredicate = useCallback(
    (label: string) => colors.get(label) as string,
    [colors]
  );

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
        groupBy={GroupBy.CATEGORY}
        noDataText="Nenhuma receita encontrada"
        colorPredicate={colorsPredicate}
        cellPrefix="revenues-pie-chart-cell"
      />
    </Stack>
  );
};
const TabsWithContent = () => (
  <StyledTabs defaultValue={0}>
    <StyledTabsList>
      <StyledTab>Categorias</StyledTab>
    </StyledTabsList>
    <TabPanel value={0}>
      <PercentageContent />
    </TabPanel>
  </StyledTabs>
);

const Content = ({ kind }: { kind: Kinds }) => {
  if (kind === Kinds.HISTORIC) return <HistoricContent />;
  return <TabsWithContent />;
};

const RevenueReports = () => {
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
            default:
              break;
          }
        }}
      >
        <Tab label="Percentual" />
        <Tab label="Histórico" />
      </ReportTabs>
      <Content kind={kind} />
    </ReportBox>
  );
};

export default RevenueReports;

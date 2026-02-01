import { Dispatch, SetStateAction, useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";

import { endOfMonth, addMonths } from "date-fns";

import {
  ChartType,
  ChartTypeToggle,
  DatePickers,
  FontSizes,
  PieChart,
  ReportBox,
  ReportTabs,
  Text,
} from "../../../../design-system";
import {
  useIncomesCreditedByAssetTypeReport,
  useIncomesHistoric,
  useIncomesTopAssetsReport,
} from "./hooks";
import { GroupBy } from "../../Assets/Reports/types";
import { AssetsTypesMapping } from "../../Assets/consts";
import { HistoricReportResponse } from "../types";
import {
  BarChartCreditedAndProvisionedWithAvg,
  HorizontalBarChart,
} from "./charts";
import { useHistoricDateState } from "../../hooks";

const colorPredicate = (label: string) => AssetsTypesMapping[label].color;

enum Kinds {
  TOP_ASSETS,
  BY_ASSET_TYPE,
}

type DatesState = {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
};

type HistoricContentProps = {
  startDate: Date;
  endDate: Date;
  aggregatePeriod: "month" | "year";
  handleAggregatePeriodChange: (newPeriod: "month" | "year") => void;
  handleStartDateChange: Dispatch<SetStateAction<Date>>;
  handleEndDateChange: Dispatch<SetStateAction<Date>>;
  chartType: ChartType;
  setChartType: (chartType: ChartType) => void;
};

const HistoricContent = ({
  startDate,
  endDate,
  aggregatePeriod,
  handleAggregatePeriodChange,
  handleStartDateChange,
  handleEndDateChange,
  chartType,
  setChartType,
}: HistoricContentProps) => {
  const {
    data,
    // isPending TODO
  } = useIncomesHistoric({ startDate, endDate, aggregatePeriod });

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
      <BarChartCreditedAndProvisionedWithAvg
        data={data?.historic as HistoricReportResponse["historic"]}
        avg={data?.avg as HistoricReportResponse["avg"]}
        aggregatePeriod={aggregatePeriod}
        chartType={chartType}
      />
    </Stack>
  );
};

const TopAssetsContent = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DatesState) => {
  const {
    data,
    //TODO isPending,
  } = useIncomesTopAssetsReport({
    startDate,
    endDate,
  });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <DatePickers
          views={["day", "month", "year"]}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      </Stack>
      <HorizontalBarChart data={data ?? []} />
    </Stack>
  );
};

const CreditedByAssetTypeContent = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DatesState) => {
  const { data, isPending } = useIncomesCreditedByAssetTypeReport({
    startDate,
    endDate,
  });

  const total = useMemo(
    () => data?.map((d) => d.total_credited).reduce((a, b) => a + b, 0) ?? 1,
    [data],
  );

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <DatePickers
          views={["day", "month", "year"]}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      </Stack>
      <PieChart
        data={
          data?.map((d) => ({
            type: d.asset_type,
            total: (d.total_credited / total) * 100,
          })) ?? []
        }
        isLoading={isPending}
        groupBy={GroupBy.TYPE}
        noDataText="Nenhum provento creditado encontrado"
        colorPredicate={colorPredicate}
        cellPrefix="incomes-credited-by-asset-type-report-pie-chart-cell"
      />
    </Stack>
  );
};

const AggregationContent = ({ kind, ...datesState }: DatesState & { kind: Kinds }) => {
  if (kind === Kinds.TOP_ASSETS) return <TopAssetsContent {...datesState} />;
  return <CreditedByAssetTypeContent {...datesState} />;
};

const Reports = () => {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [kind, setKind] = useState<Kinds>(Kinds.TOP_ASSETS);
  const [tabValue, setTabValue] = useState(0);
  const [oneYearAgo, endOfThisMonthPlus3Months] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    return [_oneYearAgo, endOfMonth(addMonths(new Date(), 3))];
  }, []);

  const {
    startDate,
    endDate,
    aggregatePeriod,
    handleAggregatePeriodChange,
    handleStartDateChange,
    handleEndDateChange,
    setStartDate,
    setEndDate,
  } = useHistoricDateState({
    initialStartDate: oneYearAgo,
    initialEndDate: endOfThisMonthPlus3Months,
  });

  return (
    <Grid container spacing={4}>
      <Grid item xs={6}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Histórico</Text>
          <ReportBox>
            <HistoricContent
              startDate={startDate}
              endDate={endDate}
              aggregatePeriod={aggregatePeriod}
              handleAggregatePeriodChange={handleAggregatePeriodChange}
              handleStartDateChange={handleStartDateChange}
              handleEndDateChange={handleEndDateChange}
              chartType={chartType}
              setChartType={setChartType}
            />
          </ReportBox>
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Agregações</Text>
          <ReportBox>
            <ReportTabs
              value={tabValue}
              onChange={(_, newValue) => {
                switch (newValue) {
                  case 0:
                    setKind(Kinds.TOP_ASSETS);
                    setTabValue(newValue);
                    break;
                  case 1:
                    setKind(Kinds.BY_ASSET_TYPE);
                    setTabValue(newValue);
                    break;
                  default:
                    break;
                }
              }}
            >
              <Tab label="Top 10 ativos" />
              <Tab label="Por tipo de ativo" />
            </ReportTabs>
            <AggregationContent
              kind={kind}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
            />
          </ReportBox>
        </Stack>
      </Grid>
    </Grid>
  );
};

export default Reports;

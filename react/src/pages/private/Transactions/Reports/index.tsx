import { useContext, useMemo } from "react";

import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import { endOfMonth } from "date-fns";

import {
  DatePickers,
  FontSizes,
  PieChart,
  ReportBox,
  Text,
} from "../../../../design-system";
import {
  useTransactionsHistoric,
  useTransactionsTotalBoughtPerAssetTypeReport,
} from "./hooks";
import PositiveNegativeBarChart from "./PositiveNegativeBarChart";
import { TransactionsContext } from "../context";
import { GroupBy } from "../../Assets/Reports/types";
import { AssetsTypesMapping } from "../../Assets/consts";
import { useHistoricDateState } from "../../hooks";

const colorPredicate = (label: string) => AssetsTypesMapping[label].color;

const HistoricContent = () => {
  const [oneYearAgo, endOfThisMonth] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    return [_oneYearAgo, endOfMonth(new Date())];
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
    initialEndDate: endOfThisMonth,
  });

  const {
    data,
    // isPending TODO
  } = useTransactionsHistoric({ startDate, endDate, aggregatePeriod });

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
      <PositiveNegativeBarChart
        data={data?.historic ?? []}
        aggregatePeriod={aggregatePeriod}
      />
    </Stack>
  );
};

const TotalBoughtPerAssetTypeContent = () => {
  const { startDate, setStartDate, endDate, setEndDate } =
    useContext(TransactionsContext);

  const { data, isPending } = useTransactionsTotalBoughtPerAssetTypeReport({
    startDate,
    endDate,
  });

  const total = useMemo(
    () => data?.map((d) => d.total_bought).reduce((a, b) => a + b, 0) ?? 1,
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
            total: (d.total_bought / total) * 100,
          })) ?? []
        }
        isLoading={isPending}
        groupBy={GroupBy.TYPE}
        noDataText="Nenhuma transação encontrada"
        colorPredicate={colorPredicate}
        cellPrefix="transactions-bought-per-asset-type-report-pie-chart-cell"
      />
    </Stack>
  );
};

const Reports = () => (
  <Grid container spacing={4}>
    <Grid item xs={7}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>Histórico</Text>
        <ReportBox>
          <HistoricContent />
        </ReportBox>
      </Stack>
    </Grid>
    <Grid item xs={5}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>
          Compras agrupadas por tipo de ativo
        </Text>
        <ReportBox>
          <TotalBoughtPerAssetTypeContent />
        </ReportBox>
      </Stack>
    </Grid>
  </Grid>
);

export default Reports;

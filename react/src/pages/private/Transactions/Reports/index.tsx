import { useContext, useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";

import { endOfMonth } from "date-fns";

import {
  DatePickers,
  PieChart,
  ReportBox,
  ReportTabs,
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

const colorPredicate = (label: string) => AssetsTypesMapping[label].color;

const HistoricContent = () => {
  const [oneYearAgo, endOfThisMonth] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    return [_oneYearAgo, endOfMonth(new Date())];
  }, []);

  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(endOfThisMonth);
  const {
    data,
    // isPending TODO
  } = useTransactionsHistoric({ startDate, endDate });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <DatePickers
          views={["month", "year"]}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      </Stack>
      <PositiveNegativeBarChart data={data?.historic ?? []} />
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

const TransactionsGroupedByAssetTypeChart = () => (
  <ReportBox>
    <ReportTabs value={0}>
      <Tab label="Agrupadas por tipo de ativo" />
    </ReportTabs>
    <TotalBoughtPerAssetTypeContent />
  </ReportBox>
);

const HistoricChart = () => (
  <ReportBox>
    <ReportTabs value={0}>
      <Tab label="Histórico" />
    </ReportTabs>
    <HistoricContent />
  </ReportBox>
);

const Reports = () => (
  <Grid container spacing={4}>
    <Grid item xs={7}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>
          Histórico de compra e venda
        </Text>
        <HistoricChart />
      </Stack>
    </Grid>
    <Grid item xs={5}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>
          Transações agrupadas por tipo de ativo
        </Text>
        <TransactionsGroupedByAssetTypeChart />
      </Stack>
    </Grid>
  </Grid>
);

export default Reports;

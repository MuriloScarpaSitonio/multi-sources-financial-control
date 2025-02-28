import type { Dispatch, SetStateAction } from "react";

import { useMemo, useState } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import { endOfMonth, addMonths } from "date-fns";

import { DatePickers, ReportBox, Text } from "../../../../design-system";
import { useIncomesHistoric, useIncomesTopAssetsReport } from "./hooks";
import { HistoricReportResponse } from "../types";
import {
  BarChartCreditedAndProvisionedWithAvg,
  HorizontalBarChart,
} from "./charts";

type DatesState = {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
};

const HistoricContent = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DatesState) => {
  const {
    data,
    // isPending TODO
  } = useIncomesHistoric({ startDate, endDate });

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
      <BarChartCreditedAndProvisionedWithAvg
        data={data?.historic as HistoricReportResponse["historic"]}
        avg={data?.avg as HistoricReportResponse["avg"]}
      />
    </Stack>
  );
};

const TotalBoughtPerAssetTypeContent = ({
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

const Top10AssetsChart = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DatesState) => (
  <ReportBox>
    <TotalBoughtPerAssetTypeContent
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
    />
  </ReportBox>
);

const HistoricChart = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: DatesState) => (
  <ReportBox>
    <HistoricContent
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
    />
  </ReportBox>
);

const Reports = () => {
  const [oneYearAgo, endOfThisMonthPlus3Months] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    return [_oneYearAgo, endOfMonth(addMonths(new Date(), 3))];
  }, []);

  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(endOfThisMonthPlus3Months);
  return (
    <Grid container spacing={4}>
      <Grid item xs={6}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Histórico</Text>
          <HistoricChart
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Top 10 ativos</Text>
          <Top10AssetsChart
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        </Stack>
      </Grid>
    </Grid>
  );
};

export default Reports;

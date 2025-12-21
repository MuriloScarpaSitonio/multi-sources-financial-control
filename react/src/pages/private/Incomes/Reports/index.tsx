import { Dispatch, SetStateAction, useMemo } from "react";

import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import { endOfMonth, addMonths } from "date-fns";

import {
  DatePickers,
  FontSizes,
  ReportBox,
  Text,
} from "../../../../design-system";
import { useIncomesHistoric, useIncomesTopAssetsReport } from "./hooks";
import { HistoricReportResponse } from "../types";
import {
  BarChartCreditedAndProvisionedWithAvg,
  HorizontalBarChart,
} from "./charts";
import { useHistoricDateState } from "../../hooks";

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
};

const HistoricContent = ({
  startDate,
  endDate,
  aggregatePeriod,
  handleAggregatePeriodChange,
  handleStartDateChange,
  handleEndDateChange,
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
      <BarChartCreditedAndProvisionedWithAvg
        data={data?.historic as HistoricReportResponse["historic"]}
        avg={data?.avg as HistoricReportResponse["avg"]}
        aggregatePeriod={aggregatePeriod}
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

const Reports = () => {
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
            />
          </ReportBox>
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Top 10 ativos</Text>
          <ReportBox>
            <TotalBoughtPerAssetTypeContent
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

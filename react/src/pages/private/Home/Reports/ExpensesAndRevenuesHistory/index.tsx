import { useMemo } from "react";

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import {
  DatePickers,
  FontSizes,
  ReportBox,
  Text,
} from "../../../../../design-system";
import { useExpensesHistoricReport } from "../../../Expenses/Reports/hooks";
import { useRevenuesHistoricReport } from "../../../Revenues/Reports/hooks";
import { useHistoricDateState } from "../../../hooks";
import Chart from "./Chart";

const ExpensesAndRevenuesHistory = () => {
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
    data: expensesHistory,
    isPending: isExpensesHistoryLoading,
    isError: isExpensesHistoryError,
  } = useExpensesHistoricReport({
    startDate,
    endDate,
    aggregatePeriod,
  });
  const {
    data: revenuesHistory,
    isPending: isRevenuesHistoryLoading,
    isError: isRevenuesHistoryError,
  } = useRevenuesHistoricReport({
    startDate,
    endDate,
    aggregatePeriod,
  });
  const isLoading = isExpensesHistoryLoading || isRevenuesHistoryLoading;
  const isError = isExpensesHistoryError || isRevenuesHistoryError;

  const chartData = useMemo(() => {
    if (isLoading || isError)
      return { historic: [], avg: { expenses: 0, revenues: 0 } };
    return {
      historic: expensesHistory.historic.map((e, index) => {
        const revenues = revenuesHistory.historic[index]?.total ?? 0;
        return {
          month: e.month,
          year: e.year,
          expenses: e.total * -1,
          revenues,
          diff: revenues - e.total,
        };
      }),
      avg: {
        expenses: expensesHistory.avg * -1,
        revenues: revenuesHistory.avg,
      },
    };
  }, [isLoading, isError, expensesHistory, revenuesHistory]);

  return (
    <ReportBox sx={{ p: 2 }}>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <Text size={FontSizes.SEMI_REGULAR}>Agregar por</Text>
          <Select
            value={aggregatePeriod}
            onChange={(e) =>
              handleAggregatePeriodChange(e.target.value as "month" | "year")
            }
            size="small"
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
      <Chart
        data={chartData}
        isLoading={isLoading}
        aggregatePeriod={aggregatePeriod}
      />
    </ReportBox>
  );
};

export default ExpensesAndRevenuesHistory;

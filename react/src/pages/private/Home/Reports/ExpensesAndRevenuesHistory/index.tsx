import { useMemo } from "react";

import { ReportBox } from "../../../../../design-system";
import { useExpensesHistoricReport } from "../../../Expenses/Reports/hooks";
import { useRevenuesHistoricReport } from "../../../Revenues/Reports/hooks";
import Chart from "./Chart";

const ExpensesAndRevenuesHistory = () => {
  const [startDate, endDate] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    const _threeMonthsInTheFuture = new Date();
    _threeMonthsInTheFuture.setMonth(_threeMonthsInTheFuture.getMonth() + 4);
    return [_oneYearAgo, _threeMonthsInTheFuture];
  }, []);

  const {
    data: expensesHistory,
    isPending: isExpensesHistoryLoading,
    isError: isExpensesHistoryError,
  } = useExpensesHistoricReport({
    startDate,
    endDate,
    aggregatePeriod: "month",
  });
  const {
    data: revenuesHistory,
    isPending: isRevenuesHistoryLoading,
    isError: isRevenuesHistoryError,
  } = useRevenuesHistoricReport({
    startDate,
    endDate,
    aggregatePeriod: "month",
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
      <Chart data={chartData} isLoading={isLoading} />
    </ReportBox>
  );
};

export default ExpensesAndRevenuesHistory;

import { useMemo, useState } from "react";

import Stack from "@mui/material/Stack";

import { DatePickers, ReportBox } from "../../../../design-system";
import { HistoricReportResponse } from "../../Expenses/types";
import { BarChartWithReferenceLine } from "../../Expenses/Reports/charts";
import { useRevenuesHistoricReport } from "./hooks";

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
  } = useRevenuesHistoricReport({ startDate, endDate });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <DatePickers
        views={["month", "year"]}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
      <BarChartWithReferenceLine
        data={data?.historic as HistoricReportResponse["historic"]}
        referenceValue={data?.avg as HistoricReportResponse["avg"]}
        variant="success"
      />
    </Stack>
  );
};

const RevenueReports = () => (
  <ReportBox>
    <HistoricContent />
  </ReportBox>
);

export default RevenueReports;

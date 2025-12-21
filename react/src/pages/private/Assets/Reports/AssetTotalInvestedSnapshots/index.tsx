import { useMemo, useState } from "react";

import Stack from "@mui/material/Stack";
import { startOfMonth, subYears } from "date-fns";

import { useAssetsTotalInvestedHistory } from "./hooks";
import {
  ChartType,
  ChartTypeToggle,
  ReportBox,
} from "../../../../../design-system";
import { useAssetsIndicators } from "../../Indicators/hooks";
import Chart from "./Chart";

const AssetTotalInvestedSnapshots = () => {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [startDate, endDate, nowString] = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = startOfMonth(now);
    return [
      subYears(firstDayOfMonth, 1),
      firstDayOfMonth,
      now.toISOString().slice(0, 10),
    ];
  }, []);

  const { data, isPending: isPatrimonyHistoryLoading } =
    useAssetsTotalInvestedHistory({ startDate, endDate });

  // this may trigger a race condition as we are querying this endpoint
  // in another component
  // TODO: consider calling once in the parent component and pass it to the
  // childrens
  const {
    data: { total } = { total: 0 },
    isPending: isAssetsIndicatorsLoading,
  } = useAssetsIndicators();

  const chartData = useMemo(() => {
    if (isAssetsIndicatorsLoading) return [];
    return [...(data ?? []), { total, operation_date: nowString }];
  }, [data, total, isAssetsIndicatorsLoading, nowString]);

  return (
    <ReportBox sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="flex-start" sx={{ mb: 1 }}>
        <ChartTypeToggle value={chartType} onChange={setChartType} />
      </Stack>
      <Chart
        data={chartData}
        isLoading={isAssetsIndicatorsLoading || isPatrimonyHistoryLoading}
        chartType={chartType}
      />
    </ReportBox>
  );
};

export default AssetTotalInvestedSnapshots;

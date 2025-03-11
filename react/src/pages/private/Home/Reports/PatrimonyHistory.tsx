import { useMemo } from "react";

import { startOfMonth, subYears } from "date-fns";

import { ReportBox } from "../../../../design-system";
import { useAssetsTotalInvestedHistory } from "../../Assets/Reports/hooks";
import { useAssetsIndicators } from "../../Assets/Indicators/hooks";
import { useBankAccount, useBankAccountHistory } from "../../Expenses/hooks";
import { default as PatrimonyHistoryChart } from "../../Assets/Reports/AssetTotalInvestedSnapshots/Chart";
import { CHART_HEIGHT, CHART_WIDTH } from "./consts";

const PatrimonyHistory = () => {
  const [startDate, endDate, nowString] = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = startOfMonth(now);
    return [
      subYears(firstDayOfMonth, 1),
      firstDayOfMonth,
      now.toISOString().slice(0, 10),
    ];
  }, []);
  const {
    data: assetsTotalInvestedHistory,
    isPending: isAssetsTotalInvestedHistoryLoading,
    isError: isAssetsTotalInvestedHistoryError,
  } = useAssetsTotalInvestedHistory({ startDate, endDate });

  const {
    data: bankAcountHistory,
    isPending: isBankAccountHisotryLoading,
    isError: isBankAccountHisotryError,
  } = useBankAccountHistory({ startDate, endDate });

  // this may trigger a race condition as we are querying this endpoint
  // in another component
  // TODO: consider calling once in the parent component and pass it to the
  // childrens
  const {
    data: { total: investedTotal } = { total: 0 },
    isPending: isAssetsIndicatorsLoading,
    isError: isAssetsIndicatorsError,
  } = useAssetsIndicators();

  // this may trigger a race condition as we are querying this endpoint
  // in another component
  // TODO: consider calling once in the parent component and pass it to the
  // childrens
  const {
    data: { amount: bankAmount } = { amount: 0 },
    isPending: isBankAccountLoading,
    isError: isBankAccountError,
  } = useBankAccount();

  const isLoading =
    isAssetsIndicatorsLoading ||
    isBankAccountLoading ||
    isAssetsTotalInvestedHistoryLoading ||
    isBankAccountHisotryLoading;
  const isError =
    isAssetsIndicatorsError ||
    isBankAccountError ||
    isAssetsTotalInvestedHistoryError ||
    isBankAccountHisotryError;

  const chartData = useMemo(() => {
    if (isLoading || isError) return [];
    return [
      ...assetsTotalInvestedHistory.map((d, index) => ({
        ...d,
        total: d.total + (bankAcountHistory[index]?.total ?? 0),
      })),
      {
        total: investedTotal + bankAmount,
        operation_date: nowString,
      },
    ];
  }, [
    assetsTotalInvestedHistory,
    bankAcountHistory,
    investedTotal,
    nowString,
    bankAmount,
    isLoading,
    isError,
  ]);
  return (
    <ReportBox sx={{ p: 2 }}>
      <PatrimonyHistoryChart
        data={chartData}
        isLoading={isLoading}
        height={CHART_HEIGHT}
        width={CHART_WIDTH}
      />
    </ReportBox>
  );
};

export default PatrimonyHistory;

import { useMemo, useState } from "react";

import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import { startOfMonth, subYears } from "date-fns";

import { ReportBox } from "../../../../../design-system";
import { useAssetsTotalInvestedHistory } from "../../../Assets/Reports/hooks";
import { useAssetsIndicators } from "../../../Assets/Indicators/hooks";
import { useBankAccount, useBankAccountHistory } from "../../../Expenses/hooks";
import Chart, { PatrimonyDataItem } from "./Chart";

const PatrimonyHistory = () => {
  const [showBreakdown, setShowBreakdown] = useState(false);
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
    data: bankAccountHistory,
    isPending: isBankAccountHistoryLoading,
    isError: isBankAccountHistoryError,
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
    isBankAccountHistoryLoading;
  const isError =
    isAssetsIndicatorsError ||
    isBankAccountError ||
    isAssetsTotalInvestedHistoryError ||
    isBankAccountHistoryError;

  const chartData: PatrimonyDataItem[] = useMemo(() => {
    if (isLoading || isError) return [];
    return [
      ...assetsTotalInvestedHistory.map((d, index) => {
        const bankAccount = bankAccountHistory[index]?.total ?? 0;
        return {
          assets: d.total,
          bankAccount,
          total: d.total + bankAccount,
          operation_date: d.operation_date,
        };
      }),
      {
        assets: investedTotal,
        bankAccount: bankAmount,
        total: investedTotal + bankAmount,
        operation_date: nowString,
      },
    ];
  }, [
    assetsTotalInvestedHistory,
    bankAccountHistory,
    investedTotal,
    nowString,
    bankAmount,
    isLoading,
    isError,
  ]);

  return (
    <ReportBox sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showBreakdown}
              onChange={(e) => setShowBreakdown(e.target.checked)}
              size="small"
            />
          }
          label="Detalhar"
          labelPlacement="start"
        />
      </Stack>
      <Chart data={chartData} isLoading={isLoading} showBreakdown={showBreakdown} />
    </ReportBox>
  );
};

export default PatrimonyHistory;


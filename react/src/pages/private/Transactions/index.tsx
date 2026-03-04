import { useCallback, useMemo, useState } from "react";

import { Month, startOfMonth } from "date-fns";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import { PeriodsManager } from "../../../design-system";
import useURLFilters from "../../../hooks/useURLFilters";
import { default as AssetIndicators } from "../Assets/Indicators";
import { TransactionsContext } from "./context";
import { transactionsFilterSchema } from "./filterConfig";
import Indicators from "./Indicators";
import Reports from "./Reports";
import Table from "./Table";
import { Filters } from "./types";
import { customEndOfMonth } from "../utils";

const defaultFilters: Filters = {
  asset_type: [],
  action: "",
};

const Transactions = () => {
  const now = new Date();
  const defaultDates = useMemo(
    () => ({
      startDate: startOfMonth(now),
      endDate: customEndOfMonth(now),
    }),
    []
  );

  const { filters, setFilters, dates, setDates } = useURLFilters<Filters>({
    schema: transactionsFilterSchema,
    defaults: defaultFilters,
    defaultDates,
  });

  const [month, setMonth] = useState(now.getMonth() as Month | undefined);
  const [year, setYear] = useState(now.getFullYear());

  const setStartDate = useCallback(
    (value: Date | ((prev: Date) => Date)) => {
      setDates((prev) => ({
        ...prev,
        startDate: typeof value === "function" ? value(prev.startDate) : value,
      }));
    },
    [setDates]
  );

  const setEndDate = useCallback(
    (value: Date | ((prev: Date) => Date)) => {
      setDates((prev) => ({
        ...prev,
        endDate: typeof value === "function" ? value(prev.endDate) : value,
      }));
    },
    [setDates]
  );

  const contextValue = useMemo(
    () => ({
      startDate: dates?.startDate ?? defaultDates.startDate,
      setStartDate,
      endDate: dates?.endDate ?? defaultDates.endDate,
      setEndDate,
      month,
      setMonth,
      year,
      setYear,
    }),
    [dates, setStartDate, setEndDate, month, year, defaultDates]
  );

  return (
    <TransactionsContext.Provider value={contextValue}>
      <Stack spacing={2}>
        <PeriodsManager context={TransactionsContext} />
        <AssetIndicators extra={<Indicators />} />
        <Reports />
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Table externalFilters={{ filters, setFilters }} />
          </Grid>
        </Grid>
      </Stack>
    </TransactionsContext.Provider>
  );
};

export default Transactions;

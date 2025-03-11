import { useMemo, useState } from "react";

import { Month, startOfMonth } from "date-fns";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import { PeriodsManager } from "../../../design-system";
import { default as AssetIndicators } from "../Assets/Indicators";
import { TransactionsContext } from "./context";
import Indicators from "./Indicators";
import Reports from "./Reports";
import Table from "./Table";
import { customEndOfMonth } from "../utils";

const Transactions = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState(startOfMonth(now));
  const [endDate, setEndDate] = useState(customEndOfMonth(now));
  const [month, setMonth] = useState(now.getMonth() as Month | undefined);
  const [year, setYear] = useState(now.getFullYear());

  const contextValue = useMemo(
    () => ({
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      month,
      setMonth,
      year,
      setYear,
    }),
    [startDate, endDate, month, year],
  );
  return (
    <TransactionsContext.Provider value={contextValue}>
      <Stack spacing={2}>
        <PeriodsManager context={TransactionsContext} />
        <AssetIndicators extra={<Indicators />} />
        <Reports />
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Table />
          </Grid>
        </Grid>
      </Stack>
    </TransactionsContext.Provider>
  );
};

export default Transactions;

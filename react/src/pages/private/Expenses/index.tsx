import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";

import Indicators from "./Indicators";
import { ExpensesContext } from "./context";
import PeriodsManager from "./PeriodsManager";
import Reports from "./Reports";
import Table from "./Table";
import { useMemo, useState } from "react";
import { endOfMonth, Month, startOfMonth } from "date-fns";

const customEndOfMonth = (date: Date) => {
  const result = endOfMonth(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const Expenses = () => {
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
    <ExpensesContext.Provider value={contextValue}>
      <Stack spacing={2}>
        <PeriodsManager />
        <Grid container spacing={4}>
          <Grid item xs={5}>
            <Indicators />
          </Grid>
          <Grid item xs={7}>
            <Reports />
          </Grid>
        </Grid>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Table />
          </Grid>
        </Grid>
      </Stack>
    </ExpensesContext.Provider>
  );
};

export default Expenses;

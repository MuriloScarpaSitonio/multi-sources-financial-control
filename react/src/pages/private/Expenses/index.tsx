import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";

import Indicators from "./Indicators";
import Reports from "./Reports";
import Table from "./Table";
import { ExpensesContext } from "./context";
import { useMemo, useState } from "react";
import { endOfMonth, startOfMonth } from "date-fns";

const Expenses = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState(startOfMonth(now));
  const [endDate, setEndDate] = useState(endOfMonth(now));

  const contextValue = useMemo(
    () => ({
      startDate,
      setStartDate,
      endDate,
      setEndDate,
    }),
    [startDate, endDate],
  );
  return (
    <ExpensesContext.Provider value={contextValue}>
      <Stack spacing={2}>
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

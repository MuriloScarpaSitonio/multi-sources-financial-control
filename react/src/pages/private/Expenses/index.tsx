import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";

import Indicators from "./Indicators";
import { ExpensesContext } from "./context";
import PeriodsManager from "./PeriodsManager";
import Reports from "./Reports";
import Table from "./Table";
import { useMemo, useState } from "react";
import { endOfMonth, Month, startOfMonth } from "date-fns";
import { useGetCategories, useGetSources } from "./hooks";

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

  const { data: categoriesData, isPending: isLoadingCategories } =
    useGetCategories({ ordering: "name" });
  const { data: sourcesData, isPending: isLoadingSources } = useGetSources({
    ordering: "name",
  });

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
      categories: {
        results: categoriesData?.results ?? [],
        hexColorMapping: new Map(
          (categoriesData?.results ?? []).map((category) => [
            category.name,
            category.hex_color,
          ]),
        ),
      },
      sources: {
        results: sourcesData?.results ?? [],
        hexColorMapping: new Map(
          (sourcesData?.results ?? []).map((source) => [
            source.name,
            source.hex_color,
          ]),
        ),
      },
      isRelatedEntitiesLoading: isLoadingCategories || isLoadingSources,
    }),
    [
      startDate,
      endDate,
      month,
      year,
      categoriesData,
      sourcesData,
      isLoadingCategories,
      isLoadingSources,
    ],
  );
  return (
    <ExpensesContext.Provider value={contextValue}>
      <Stack spacing={2}>
        <PeriodsManager />
        <Grid container spacing={4}>
          <Grid item xs={6}>
            <Indicators />
          </Grid>
          <Grid item xs={6}>
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

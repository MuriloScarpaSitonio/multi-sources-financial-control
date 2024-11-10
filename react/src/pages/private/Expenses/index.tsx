import { useMemo, useState, type SyntheticEvent } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { endOfMonth, Month, startOfMonth } from "date-fns";

import { default as RevenueReports } from "../Revenues/Reports";
import { default as RevenuesTable } from "../Revenues/Table";
import { ExpensesContext } from "./context";
import { useGetCategories, useGetSources } from "./hooks";
import Indicators from "./Indicators";
import PeriodsManager from "./PeriodsManager";
import { default as ExpenseReports } from "./Reports";
import { default as ExpensesTable } from "./Table";
import { Colors, getColor } from "../../../design-system";

const customEndOfMonth = (date: Date) => {
  const result = endOfMonth(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const CustomTabs = ({
  tabValue,
  onTabChange,
}: {
  tabValue: number;
  onTabChange: (event: SyntheticEvent, value: number) => void;
}) => (
  <Tabs
    value={tabValue}
    onChange={onTabChange}
    TabIndicatorProps={{
      sx: { background: getColor(Colors.neutral0), height: "1.5px" },
    }}
    textColor="inherit"
    visibleScrollbar
  >
    <Tab label="Despesas" />
    <Tab label="Receitas" />
  </Tabs>
);

const Expenses = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState(startOfMonth(now));
  const [endDate, setEndDate] = useState(customEndOfMonth(now));
  const [month, setMonth] = useState(now.getMonth() as Month | undefined);
  const [year, setYear] = useState(now.getFullYear());
  const [tabValue, setTabValue] = useState(0);

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
            <CustomTabs
              tabValue={tabValue}
              onTabChange={(_: SyntheticEvent, value: number) =>
                setTabValue(value)
              }
            />
            {tabValue === 0 && <ExpenseReports />}
            {tabValue === 1 && <RevenueReports />}
          </Grid>
        </Grid>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <CustomTabs
              tabValue={tabValue}
              onTabChange={(_: SyntheticEvent, value: number) =>
                setTabValue(value)
              }
            />
            {tabValue === 0 && <ExpensesTable />}
            {tabValue === 1 && <RevenuesTable />}
          </Grid>
        </Grid>
      </Stack>
    </ExpensesContext.Provider>
  );
};

export default Expenses;

import { useMemo, useState, type Context, type SyntheticEvent } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { useSearchParams } from "react-router-dom";
import { Month, startOfMonth } from "date-fns";

import { Colors, getColor, PeriodsManager } from "../../../design-system";
import { ContextType as PeriodsManagerContextType } from "../../../design-system/components/PeriodsManager";
import { default as RevenueReports } from "../Revenues/Reports";
import { default as RevenuesTable } from "../Revenues/Table";
import { useGetCategories as useRevenuesCategories } from "../Revenues/hooks/useGetCategories";
import { ExpensesContext } from "./context";
import { useGetCategories, useGetSources } from "./hooks";
import Indicators from "./Indicators";
import { default as ExpenseReports } from "./Reports";
import { default as ExpensesTable } from "./Table";
import { customEndOfMonth } from "../utils";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const displayRevenuesComponents = searchParams.get("revenues") === "true";

  const { data: categoriesData, isPending: isLoadingCategories } =
    useGetCategories({ ordering: "name" });
  const { data: sourcesData, isPending: isLoadingSources } = useGetSources({
    ordering: "name",
    enabled: !displayRevenuesComponents,
  });
  const {
    data: revenuesCategoriesData,
    isLoading: isLoadingRevenuesCategories,
  } = useRevenuesCategories({
    ordering: "name",
    enabled: displayRevenuesComponents,
  });

  const isRelatedEntitiesLoading = displayRevenuesComponents
    ? isLoadingRevenuesCategories || isLoadingCategories
    : isLoadingCategories || isLoadingSources;

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
      revenuesCategories: {
        results: revenuesCategoriesData?.results ?? [],
        hexColorMapping: new Map(
          (revenuesCategoriesData?.results ?? []).map((category) => [
            category.name,
            category.hex_color,
          ]),
        ),
      },
      isRelatedEntitiesLoading,
    }),
    [
      startDate,
      endDate,
      month,
      year,
      categoriesData?.results,
      sourcesData?.results,
      revenuesCategoriesData?.results,
      isRelatedEntitiesLoading,
    ],
  );
  return (
    <ExpensesContext.Provider value={contextValue}>
      <Stack spacing={2}>
        <PeriodsManager
          context={
            ExpensesContext as unknown as Context<PeriodsManagerContextType>
          }
        />
        <Grid container spacing={4}>
          <Grid item xs={6}>
            <Indicators />
          </Grid>
          <Grid item xs={6}>
            <CustomTabs
              tabValue={displayRevenuesComponents ? 1 : 0}
              onTabChange={(_: SyntheticEvent, value: number) =>
                setSearchParams({ revenues: value === 1 ? "true" : "false" })
              }
            />
            {displayRevenuesComponents ? (
              <RevenueReports />
            ) : (
              <ExpenseReports />
            )}
          </Grid>
        </Grid>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <CustomTabs
              tabValue={displayRevenuesComponents ? 1 : 0}
              onTabChange={(_: SyntheticEvent, value: number) =>
                setSearchParams({ revenues: value === 1 ? "true" : "false" })
              }
            />
            {displayRevenuesComponents ? <RevenuesTable /> : <ExpensesTable />}
          </Grid>
        </Grid>
      </Stack>
    </ExpensesContext.Provider>
  );
};

export default Expenses;

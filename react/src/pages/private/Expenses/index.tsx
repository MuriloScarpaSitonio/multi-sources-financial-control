import { useCallback, useMemo, useState, type Context, type SyntheticEvent } from "react";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { Month, startOfMonth } from "date-fns";
import { useSearchParams } from "react-router-dom";

import { Colors, getColor, PeriodsManager } from "../../../design-system";
import { ContextType as PeriodsManagerContextType } from "../../../design-system/components/PeriodsManager";
import useURLFilters from "../../../hooks/useURLFilters";
import { useGetCategories as useRevenuesCategories, useGetMostCommonCategory as useRevenuesMostCommonCategory } from "../Revenues/hooks/useGetCategories";
import { revenuesFilterSchema } from "../Revenues/filterConfig";
import { default as RevenueReports } from "../Revenues/Reports";
import { default as RevenuesTable } from "../Revenues/Table";
import { Filters as RevenueFilters } from "../Revenues/types";
import { customEndOfMonth } from "../utils";
import { ExpensesContext } from "./context";
import { expensesFilterSchema } from "./filterConfig";
import { useGetCategories, useGetMostCommonCategory, useGetMostCommonSource, useGetSources } from "./hooks";
import Indicators from "./Indicators";
import { default as ExpenseReports } from "./Reports";
import { default as ExpensesTable } from "./Table";
import { Filters as ExpenseFilters } from "./types";

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

const defaultExpenseFilters: ExpenseFilters = {};
const defaultRevenueFilters: RevenueFilters = {};

const Expenses = () => {
  const now = new Date();
  const defaultDates = useMemo(
    () => ({
      startDate: startOfMonth(now),
      endDate: customEndOfMonth(now),
    }),
    []
  );

  // URL filters for expenses (includes dates)
  const {
    filters: expenseFilters,
    setFilters: setExpenseFilters,
    dates,
    setDates,
  } = useURLFilters<ExpenseFilters>({
    schema: expensesFilterSchema,
    defaults: defaultExpenseFilters,
    defaultDates,
  });

  // URL filters for revenues (scoped with "revenues_" prefix)
  const {
    filters: revenueFilters,
    setFilters: setRevenueFilters,
  } = useURLFilters<RevenueFilters>({
    schema: revenuesFilterSchema,
    defaults: defaultRevenueFilters,
    scope: "revenues",
  });

  const [month, setMonth] = useState(now.getMonth() as Month | undefined);
  const [year, setYear] = useState(now.getFullYear());
  const [searchParams, setSearchParams] = useSearchParams();

  const displayRevenuesComponents = searchParams.get("revenues") === "true";

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

  const handleTabChange = useCallback(
    (_: SyntheticEvent, value: number) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set("revenues", value === 1 ? "true" : "false");
        return newParams;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const { data: categoriesData, isPending: isLoadingCategories } =
    useGetCategories({ ordering: "name" });
  const { data: sourcesData, isPending: isLoadingSources } = useGetSources({
    ordering: "name",
    enabled: !displayRevenuesComponents,
  });
  const { data: mostCommonCategory } = useGetMostCommonCategory({ enabled: !displayRevenuesComponents });
  const { data: mostCommonSource } = useGetMostCommonSource({ enabled: !displayRevenuesComponents });
  const {
    data: revenuesCategoriesData,
    isLoading: isLoadingRevenuesCategories,
  } = useRevenuesCategories({
    ordering: "name",
    enabled: displayRevenuesComponents,
  });
  const { data: mostCommonRevenueCategory } = useRevenuesMostCommonCategory({
    enabled: displayRevenuesComponents,
  });

  const isRelatedEntitiesLoading = displayRevenuesComponents
    ? isLoadingRevenuesCategories || isLoadingCategories
    : isLoadingCategories || isLoadingSources;

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
      mostCommonCategory,
      mostCommonSource,
      mostCommonRevenueCategory,
    }),
    [
      dates,
      defaultDates,
      setStartDate,
      setEndDate,
      month,
      year,
      categoriesData?.results,
      sourcesData?.results,
      revenuesCategoriesData?.results,
      isRelatedEntitiesLoading,
      mostCommonCategory,
      mostCommonSource,
      mostCommonRevenueCategory,
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
              onTabChange={handleTabChange}
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
              onTabChange={handleTabChange}
            />
            {displayRevenuesComponents ? (
              <RevenuesTable externalFilters={{ filters: revenueFilters, setFilters: setRevenueFilters }} />
            ) : (
              <ExpensesTable externalFilters={{ filters: expenseFilters, setFilters: setExpenseFilters }} />
            )}
          </Grid>
        </Grid>
      </Stack>
    </ExpensesContext.Provider>
  );
};

export default Expenses;

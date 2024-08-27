import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
  type MRT_Row as Row,
  type MRT_TableInstance as DataTable,
  MRT_ExpandAllButton,
} from "material-react-table";

import {
  Text,
  FontSizes,
  FontWeights,
  getFontWeight,
  getFontSize,
} from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import useTable from "../../../../hooks/useTable";
import { getExpenses } from "../api/expenses";
import { Expense } from "../api/models";

import { ExpensesCategoriesMapping, EXPENSES_QUERY_KEY } from "../consts";
import { RawDateString } from "../../../../types";
// import AssetsForm from "./AssetForm";
// import TopToolBar from "./TopToolbar";

const getExpensesGroupedByType = async (filters: {
  page?: number;
  page_size?: number;
  ordering?: string;
  start_date?: Date;
  end_date?: Date;
  description?: string;
  category?: string[];
  source?: string[];
}) => {
  const [expenses, fixedExpenses, expensesWInstallments] = await Promise.all([
    getExpenses({
      ...filters,
      is_fixed: false,
      with_installments: false,
    }),
    getExpenses({ ...filters, is_fixed: true, page: 1, page_size: 100 }),
    getExpenses({
      ...filters,
      with_installments: true,
      page: 1,
      page_size: 100,
    }),
  ]);

  return {
    results: [
      ...fixedExpenses?.results?.map((obj: Expense) => ({
        ...obj,
        type: "Custos fixos",
      })),
      ...expensesWInstallments?.results?.map((obj: Expense) => ({
        ...obj,
        type: "Parcelas",
      })),
      ...expenses?.results?.map((obj: Expense) => ({ ...obj, type: "Outros" })),
    ],
    count: expenses?.count,
  };
};

const Table = () => {
  const today = new Date();
  const columns = useMemo<Column<Expense>[]>(
    () => [
      { header: "", accessorKey: "type", size: 25 },
      {
        header: "Descrição",
        accessorKey: "full_description",
        size: 100,
      },
      {
        header: "Preço",
        accessorKey: "value",
        size: 40,
        Cell: ({ cell }) => {
          const price = cell.getValue<number>().toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return `R$ ${price}`;
        },
        aggregationFn: "sum",
        AggregatedCell: ({ cell, row }) => {
          return (
            <Text
              weith={FontWeights.SEMI_BOLD}
              size={FontSizes.SMALL}
            >{`R$ ${cell.getValue<number>().toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}</Text>
          );
        },
      },
      {
        header: "Data",
        accessorKey: "created_at",
        size: 40,
        Cell: ({ cell }) => {
          const [year, month, day] = cell.getValue<RawDateString>().split("-");
          return `${day}/${month}/${year}`;
        },
      },
      {
        header: "Categoria",
        accessorKey: "category",
        size: 80,
        Cell: ({ cell }) => {
          const category = cell.getValue<string>();
          const { color } =
            ExpensesCategoriesMapping[
              category as keyof typeof ExpensesCategoriesMapping
            ];
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusDot variant="custom" color={color} />
              <span>{category}</span>
            </Stack>
          );
        },
      },
    ],
    [],
  );

  const {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    filters,
    setFilters,
  } = useTable({
    columns: columns as Column<any>[],
    queryKey: EXPENSES_QUERY_KEY,
    enableExpanding: true,
    enableExpandAll: true,
    enableGrouping: true,
    manualExpanding: false,
    groupedColumnMode: "remove",
    positionToolbarAlertBanner: "none",
    defaultPageSize: 100,
    initialState: { grouping: ["type"], expanded: { "type:Outros": true } },
    displayColumnDefOptions: {
      "mrt-row-expand": {
        muiTableBodyCellProps: ({ row }) => ({
          sx: {
            fontWeight: getFontWeight(FontWeights.SEMI_BOLD),
            fontSize: getFontSize(FontSizes.SMALL),
          },
        }),
        size: 10,
      },
    },
    defaultFilters: {
      start_date: new Date(today.getFullYear(), today.getMonth(), 1),
      end_date: new Date(today.getFullYear(), today.getMonth() + 1, 0),
    },
    queryFn: () =>
      getExpensesGroupedByType({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering: sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "",
        description: search,
        ...filters,
      }),
    getRowId: (row: Expense) => row.id?.toString(),
    // renderTopToolbar: ({ table }) => (
    //   <TopToolBar
    //     table={table as DataTable<Asset>}
    //     setSearch={setSearch}
    //     setPagination={setPagination}
    //     setFilters={setFilters}
    //   />
    // ),
  });

  return <MaterialReactTable table={table} />;
};

export default Table;

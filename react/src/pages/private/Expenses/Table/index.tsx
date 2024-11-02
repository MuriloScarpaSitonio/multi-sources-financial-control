import type { ApiListResponse, RawDateString } from "../../../../types";
import type { Filters } from "../types";

import { useMemo, useContext, useState } from "react";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";
import { useQueryClient } from "@tanstack/react-query";

import {
  Text,
  FontSizes,
  FontWeights,
  getFontWeight,
  getFontSize,
  getColor,
  Colors,
} from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import useTable from "../../../../hooks/useTable";
import { getExpenses } from "../api/expenses";
import { Expense } from "../api/models";

import { EXPENSES_QUERY_KEY } from "../consts";
import { ExpensesContext } from "../context";
import { useInvalidateExpenseQueries } from "../hooks";
import DeleteExpenseDialog from "./DeleteExpenseDialog";
import TopToolBar from "./ToopToolBar";

type GroupedExpense = Expense & { type: string };

const getExpensesGroupedByType = async (
  filters: Filters & {
    startDate: Date;
    endDate: Date;
    page?: number;
    page_size?: number;
    ordering?: string;
    description?: string;
  },
): Promise<ApiListResponse<GroupedExpense>> => {
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

const useOnExpenseDeleteSuccess = () => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateExpensesQueries } =
    useInvalidateExpenseQueries(queryClient);

  const removeExpenseFromCachedData = (expenseId: number) => {
    const expensesData = queryClient.getQueriesData({
      queryKey: [EXPENSES_QUERY_KEY],
      type: "active",
    });
    expensesData.forEach(([queryKey]) => {
      queryClient.setQueryData(
        queryKey,
        (oldData: ApiListResponse<GroupedExpense>) => ({
          ...oldData,
          count: oldData.count - 1,
          results: oldData.results.filter(
            (expense) => expense.id !== expenseId,
          ),
        }),
      );
    });
  };
  return {
    onDeleteSuccess: async (expenseId: number) => {
      await invalidateExpensesQueries({ invalidateTableQuery: false });
      removeExpenseFromCachedData(expenseId);
    },
  };
};

const Table = () => {
  const [deleteExpense, setDeleteExpense] = useState<
    GroupedExpense | undefined
  >();

  const { startDate, endDate, categories, sources, isRelatedEntitiesLoading } =
    useContext(ExpensesContext);
  const columns = useMemo<Column<GroupedExpense>[]>(
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
        AggregatedCell: ({ cell }) => (
          <Text weith={FontWeights.SEMI_BOLD} size={FontSizes.SMALL}>{`R$ ${cell
            .getValue<number>()
            .toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}</Text>
        ),
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
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusDot
                variant="custom"
                color={categories.hexColorMapping.get(category)}
              />
              <span>{category}</span>
            </Stack>
          );
        },
      },
      {
        header: "Fonte",
        accessorKey: "source",
        size: 80,
        Cell: ({ cell }) => {
          const source = cell.getValue<string>();
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusDot
                variant="custom"
                color={sources.hexColorMapping.get(source)}
              />
              <span>{source}</span>
            </Stack>
          );
        },
      },
    ],
    [categories, sources],
  );

  const { onDeleteSuccess } = useOnExpenseDeleteSuccess();
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
    queryKey: [
      EXPENSES_QUERY_KEY,
      startDate.toLocaleDateString("pt-br"),
      endDate.toLocaleDateString("pt-br"),
    ],
    enableExpanding: true,
    enableExpandAll: true,
    enableGrouping: true,
    manualExpanding: false,
    groupedColumnMode: "remove",
    positionToolbarAlertBanner: "none",
    defaultPageSize: 100,
    editDisplayMode: "custom",
    enableRowActions: true,
    enableToolbarInternalActions: true,
    isLoading: isRelatedEntitiesLoading,
    positionActionsColumn: "last",
    initialState: { grouping: ["type"], expanded: { "type:Outros": true } },
    displayColumnDefOptions: {
      "mrt-row-expand": {
        muiTableBodyCellProps: () => ({
          sx: {
            fontWeight: getFontWeight(FontWeights.SEMI_BOLD),
            fontSize: getFontSize(FontSizes.SMALL),
          },
        }),
        size: 10,
      },
    },
    queryFn: () =>
      getExpensesGroupedByType({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering:
          sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "-created_at",
        description: search,
        startDate,
        endDate,
        ...(filters as Filters),
      }),
    getRowId: (row: Expense) => row.id?.toString(),
    renderTopToolbar: ({ table }) => (
      <TopToolBar
        table={table}
        setSearch={setSearch}
        setPagination={setPagination}
        filters={filters as Filters}
        setFilters={setFilters}
      />
    ),
    renderRowActions: ({ row, table }) => (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Editar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => table.setEditingRow(row)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Deletar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setDeleteExpense(row.original)}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    ),
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <DeleteExpenseDialog
        expense={deleteExpense as GroupedExpense}
        open={!!deleteExpense}
        onClose={() => setDeleteExpense(undefined)}
        onSuccess={onDeleteSuccess}
      />
    </>
  );
};

export default Table;

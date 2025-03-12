import type { ApiListResponse, RawDateString } from "../../../../types";
import type { Filters } from "../types";

import { useCallback, useContext, useMemo, useState } from "react";

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

import { getColor, Colors } from "../../../../design-system";
import useTable from "../../../../hooks/useTable";
import { getIncomes } from "../api";
import { Income } from "../types";
import { INCOMES_QUERY_KEY } from "../consts";
import DeleteIncomeDialog from "./DeleteIncomeDialog";
import TopToolBar from "./ToopToolBar";
import { AssetCurrencyMap } from "../../Assets/consts";
import { IncomesContext } from "../context";
import { useOnFormSuccess as useInvalidateIncomesQueries } from "../components/CreateOrEditIncomeDrawer/hooks";
import CreateOrEditIncomeDrawer from "../components/CreateOrEditIncomeDrawer";

export const useOnIncomeDeleteSuccess = () => {
  const queryClient = useQueryClient();

  const { onSuccess: invalidateIncomesQueries } = useInvalidateIncomesQueries({
    client: queryClient,
    variant: "income",
  });

  const removeTransactionFromCachedData = useCallback(
    (incomeId: number) => {
      const transactionsData = queryClient.getQueriesData({
        queryKey: [INCOMES_QUERY_KEY],
        type: "active",
      });
      transactionsData.forEach(([queryKey]) => {
        queryClient.setQueryData(
          queryKey,
          (oldData: ApiListResponse<Income>) => ({
            ...oldData,
            count: oldData.count - 1,
            results: oldData.results.filter((income) => income.id !== incomeId),
          }),
        );
      });
    },
    [queryClient],
  );

  const onDeleteSuccess = useCallback(
    async ({
      incomeId,
      isCredited,
    }: {
      incomeId: number;
      isCredited: boolean;
    }) => {
      await invalidateIncomesQueries({
        isCredited,
        invalidateIncomesTableQuery: false,
      });
      removeTransactionFromCachedData(incomeId);
    },
    [invalidateIncomesQueries, removeTransactionFromCachedData],
  );

  return { onDeleteSuccess };
};

const Table = () => {
  const [deleteIncome, setDeleteIncome] = useState<Income | undefined>();
  const [editIncome, setEditIncome] = useState<Income | undefined>();

  const { startDate, endDate } = useContext(IncomesContext);
  const columns = useMemo<Column<Income>[]>(
    () => [
      {
        header: "Código ativo",
        acessorKey: "asset.code",
        size: 50,
        Cell: ({ row: { original } }) => original.asset.code,
      },
      {
        header: "Categoria ativo",
        acessorKey: "asset.type",
        enableSorting: false,
        size: 40,
        Cell: ({ row: { original } }) => original.asset.type,
      },
      {
        header: "Data",
        accessorKey: "operation_date",
        size: 40,
        Cell: ({ cell }) => {
          const [year, month, day] = cell.getValue<RawDateString>().split("-");
          return `${day}/${month}/${year}`;
        },
      },
      {
        header: "Tipo",
        accessorKey: "type",
        enableSorting: false,
        size: 40,
      },
      {
        header: "Evento",
        accessorKey: "event_type",
        enableSorting: false,
        size: 40,
      },
      {
        header: "Montante",
        accessorKey: "amount",
        enableSorting: false,
        size: 100,
        Cell: ({ row: { original } }) => {
          const price = original.amount.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${AssetCurrencyMap[original.asset.currency].symbol} ${price}`;
        },
      },
    ],
    [],
  );

  const { onDeleteSuccess } = useOnIncomeDeleteSuccess();
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
      INCOMES_QUERY_KEY,
      startDate.toLocaleDateString("pt-br"),
      endDate.toLocaleDateString("pt-br"),
    ],
    positionToolbarAlertBanner: "none",
    defaultPageSize: 100,
    editDisplayMode: "custom",
    enableRowActions: true,
    enableToolbarInternalActions: true,
    positionActionsColumn: "last",
    localization: {
      noRecordsToDisplay: "Nenhum rendimento encontrado",
      actions: "",
    },
    queryFn: () =>
      getIncomes({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering:
          sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ??
          "-operation_date",
        asset_code: search,
        startDate,
        endDate,
        ...(filters as Filters),
      }),
    getRowId: (row: Income) => row.id?.toString(),
    renderTopToolbar: ({ table }) => (
      <TopToolBar
        table={table}
        search={search}
        setSearch={setSearch}
        setPagination={setPagination}
        setFilters={setFilters}
      />
    ),
    renderRowActions: ({ row }) => (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Editar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setEditIncome(row.original)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Deletar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setDeleteIncome(row.original)}
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
      <DeleteIncomeDialog
        income={deleteIncome as Income}
        open={!!deleteIncome}
        onClose={() => setDeleteIncome(undefined)}
        onSuccess={onDeleteSuccess}
      />
      <CreateOrEditIncomeDrawer
        income={editIncome as Income}
        open={!!editIncome}
        onClose={() => setEditIncome(undefined)}
        variant="income"
      />
    </>
  );
};

export default Table;

import type { ApiListResponse, RawDateString } from "../../../../types";
import type { Filters } from "../types";

import { useContext, useMemo, useState } from "react";

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
import { getTransactions } from "../api";
import { Transaction } from "../types";

import { TRANSACTIONS_QUERY_KEY } from "../consts";
import { useInvalidateTransactionsQueries } from "./hooks";
import DeleteTransactionDialog from "./DeleteTransactionDialog";
import EditTransactionDrawer from "./EditTransactionDrawer";

import TopToolBar from "./ToopToolBar";
import { AssetCurrencyMap } from "../../Assets/consts";
import { TransactionsContext } from "../context";

export const useOnTransactionDeleteSuccess = () => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateTransactionsQueries } =
    useInvalidateTransactionsQueries(queryClient);

  const removeTransactionFromCachedData = (transactionId: number) => {
    const transactionsData = queryClient.getQueriesData({
      queryKey: [TRANSACTIONS_QUERY_KEY],
      type: "active",
    });
    transactionsData.forEach(([queryKey]) => {
      queryClient.setQueryData(
        queryKey,
        (oldData: ApiListResponse<Transaction>) => ({
          ...oldData,
          count: oldData.count - 1,
          results: oldData.results.filter(
            (transaction) => transaction.id !== transactionId,
          ),
        }),
      );
    });
  };
  return {
    onDeleteSuccess: async (transactionId: number) => {
      await invalidateTransactionsQueries({ invalidateTableQuery: false });
      removeTransactionFromCachedData(transactionId);
    },
  };
};

const Table = () => {
  const [deleteTransaction, setDeleteTransaction] = useState<
    Transaction | undefined
  >();
  const [editTransaction, setEditTransaction] = useState<
    Transaction | undefined
  >();

  const { startDate, endDate } = useContext(TransactionsContext);
  const columns = useMemo<Column<Transaction>[]>(
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
        header: "Negociação",
        accessorKey: "action",
        enableSorting: false,
        size: 40,
      },
      {
        header: "Quantidade",
        accessorKey: "quantity",
        enableSorting: false,
        size: 100,
        Cell: ({ cell }) =>
          cell.getValue<number | null>()?.toLocaleString("pt-br") ?? "",
      },
      {
        header: "Preço",
        accessorKey: "price",
        enableSorting: false,
        size: 100,
        Cell: ({ row: { original } }) => {
          const price = original.price.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${AssetCurrencyMap[original.asset.currency].symbol} ${price}`;
        },
      },
    ],
    [],
  );

  const { onDeleteSuccess } = useOnTransactionDeleteSuccess();
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
      TRANSACTIONS_QUERY_KEY,
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
      noRecordsToDisplay: "Nenhuma transação encontrada",
      actions: "",
    },
    queryFn: () =>
      getTransactions({
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
    getRowId: (row: Transaction) => row.id?.toString(),
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
            onClick={() => setEditTransaction(row.original)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Deletar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setDeleteTransaction(row.original)}
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
      <DeleteTransactionDialog
        transaction={deleteTransaction as Transaction}
        open={!!deleteTransaction}
        onClose={() => setDeleteTransaction(undefined)}
        onSuccess={onDeleteSuccess}
      />
      <EditTransactionDrawer
        transaction={editTransaction as Transaction}
        open={!!editTransaction}
        onClose={() => setEditTransaction(undefined)}
      />
    </>
  );
};

export default Table;

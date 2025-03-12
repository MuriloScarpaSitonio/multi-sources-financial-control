import { useMemo, useState } from "react";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";

import useTable from "../../../../hooks/useTable";
import { getColor, Colors } from "../../../../design-system";
import { RawDateString } from "../../../../types";
import { getAssetTransactions } from "../api";
import { Transaction } from "../api/models";
import { ASSETS_QUERY_KEY } from "./consts";
import { getExpandedRowSubTableLayoutProps } from "./utils";
import DeleteTransactionDialog from "../../Transactions/Table/DeleteTransactionDialog";
import EditTransactionDrawer from "../../Transactions/Table/EditTransactionDrawer";
import { useOnTransactionDeleteSuccess } from "../../Transactions/Table";

const TransactionTable = ({
  assetId,
  currencySymbol,
}: {
  assetId: number;
  currencySymbol: string;
}) => {
  const [deleteTransaction, setDeleteTransaction] = useState<
    Transaction | undefined
  >();
  const [editTransaction, setEditTransaction] = useState<
    Transaction | undefined
  >();

  const { onDeleteSuccess } = useOnTransactionDeleteSuccess();

  const columns = useMemo<Column<Transaction>[]>(
    () => [
      {
        header: "Negociação",
        accessorKey: "action",
        enableSorting: false,
      },
      {
        header: "Preço",
        accessorKey: "price",
        enableSorting: false,
        Cell: ({ row: { original } }) => {
          const price = original.price.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${currencySymbol} ${price}`;
        },
      },
      {
        header: "Quantidade",
        accessorKey: "quantity",
        enableSorting: false,
        Cell: ({ cell }) =>
          cell.getValue<number | null>()?.toLocaleString("pt-br") ?? "",
      },
      {
        header: "Data",
        accessorKey: "operation_date",
        Cell: ({ cell }) => {
          const [year, month, day] = cell.getValue<RawDateString>().split("-");
          return `${day}/${month}/${year}`;
        },
      },
    ],
    [currencySymbol],
  );

  const { table, pagination, sorting } = useTable({
    ...getExpandedRowSubTableLayoutProps(),
    enableRowActions: true,
    editDisplayMode: "custom",
    positionActionsColumn: "last",
    columns: columns as Column<any>[],
    queryKey: [ASSETS_QUERY_KEY, assetId.toString(), "transactions"],
    queryFn: () =>
      getAssetTransactions({
        assetId,
        params: {
          page: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
          ordering: sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "",
        },
      }),
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

export default TransactionTable;

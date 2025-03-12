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
import { RawDateString } from "../../../../types";
import { getAssetIncomes } from "../api";
import { Income } from "../../Incomes/types";
import { ASSETS_QUERY_KEY } from "./consts";
import { getExpandedRowSubTableLayoutProps } from "./utils";
import DeleteIncomeDialog from "../../Incomes/Table/DeleteIncomeDialog";
import CreateOrEditIncomeDrawer from "../../Incomes/components/CreateOrEditIncomeDrawer";
import { useOnIncomeDeleteSuccess } from "../../Incomes/Table";
import { getColor, Colors } from "../../../../design-system";

const IncomesTable = ({
  assetId,
  currencySymbol,
}: {
  assetId: number;
  currencySymbol: string;
}) => {
  const [deleteIncome, setDeleteIncome] = useState<Income | undefined>();
  const [editIncome, setEditIncome] = useState<Income | undefined>();

  const { onDeleteSuccess } = useOnIncomeDeleteSuccess();

  const columns = useMemo<Column<Income>[]>(
    () => [
      {
        header: "Tipo",
        accessorKey: "type",
        enableSorting: false,
      },
      {
        header: "Evento",
        accessorKey: "event_type",
        enableSorting: false,
      },
      {
        header: "Valor líquido",
        accessorKey: "amount",
        enableSorting: false,
        Cell: ({ row: { original } }) => {
          const amount = original.amount.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${currencySymbol} ${amount}`;
        },
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
    queryKey: [ASSETS_QUERY_KEY, assetId.toString(), "incomes"],
    queryFn: () =>
      getAssetIncomes({
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

export default IncomesTable;

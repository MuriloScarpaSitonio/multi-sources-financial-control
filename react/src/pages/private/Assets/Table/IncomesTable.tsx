import { useMemo } from "react";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";

import useTable from "../../../../hooks/useTable";
import { RawDateString } from "../../../../types";
import { getAssetIncomes } from "../api";
import { Income } from "../api/models";
import { getExpandedRowSubTableLayoutProps } from "./utils";

const IncomesTable = ({
  assetId,
  currencySymbol,
}: {
  assetId: number;
  currencySymbol: string;
}) => {
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
    columns: columns as Column<any>[],
    queryKey: `assets-${assetId}-incomes`,
    queryFn: () =>
      getAssetIncomes({
        assetId,
        params: {
          page: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
          ordering: sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "",
        },
      }),
  });

  return <MaterialReactTable table={table} />;
};

export default IncomesTable;

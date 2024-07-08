import { useMemo } from "react";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";

import useTable from "../../../../hooks/useTable";
import { RawDateString } from "../../../../types";
import { getAssetTransactions } from "../api";
import { Transaction } from "../api/models";
import { getExpandedRowSubTableLayoutProps } from "./utils";

const TransactionTable = ({
  assetId,
  currencySymbol,
}: {
  assetId: number;
  currencySymbol: string;
}) => {
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
        Cell: ({ cell }) => cell.getValue<number>().toLocaleString("pt-br"),
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
    queryKey: `assets-${assetId}-transactions`,
    queryFn: () =>
      getAssetTransactions({
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

export default TransactionTable;

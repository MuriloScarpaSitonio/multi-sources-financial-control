import { useMemo } from "react";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
  useMaterialReactTable,
} from "material-react-table";

import { Colors, getColor } from "../../../../../../design-system";
import { SimulatedAssetResponse } from "../../../api/types";

const SimulatedTransactionTable = ({
  currencySymbol,
  simulatedAsset,
}: {
  currencySymbol?: string;
  simulatedAsset: SimulatedAssetResponse;
}) => {
  const columns = useMemo<
    Column<SimulatedAssetResponse["old"] & { situation: string }>[]
  >(
    () => [
      {
        header: "Situação",
        accessorKey: "situation",
        size: 10,
      },
      {
        header: "Preço médio",
        accessorKey: "adjusted_avg_price",
        size: 60,
        Cell: ({ cell }) => {
          const amount = cell.getValue<number>().toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          });
          return `${currencySymbol} ${amount}`;
        },
      },
      {
        header: "ROI",
        accessorKey: "roi",
        size: 120,
        Cell: ({ cell }) => {
          const roi = cell.getValue<number>();
          const price = roi.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return (
            <span
              style={{
                color:
                  roi > 0 ? getColor(Colors.brand) : getColor(Colors.danger200),
              }}
            >
              {`R$ ${price}`}
            </span>
          );
        },
      },
      {
        header: "ROI %",
        accessorKey: "roi_percentage",
        size: 60,
        Cell: ({ cell }) => {
          const percentage = cell.getValue<number>();
          const roi = percentage.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          });
          return (
            <span
              style={{
                color:
                  percentage > 0
                    ? getColor(Colors.brand)
                    : getColor(Colors.danger200),
              }}
            >
              {`${roi}%`}
            </span>
          );
        },
      },
      {
        header: "Total investido",
        accessorKey: "normalized_total_invested",
        size: 180,
        Cell: ({ cell }) => {
          const total = cell.getValue<number>().toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return `R$ ${total}`;
        },
      },
    ],
    [currencySymbol],
  );

  const table = useMaterialReactTable({
    columns,
    data: [
      { ...simulatedAsset.old, situation: "Atual" },
      { ...simulatedAsset.new, situation: "Simulada" },
    ],
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableColumnDragging: false,
    enableColumnOrdering: false,
    enableHiding: false,
    enableExpandAll: false,
    enableColumnActions: false,
    enableFilters: false,
    enableColumnPinning: false,
    enableColumnResizing: false,
    enablePagination: false,
    enableSorting: false,
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: getColor(Colors.neutral600),
        borderBottomColor: getColor(Colors.neutral0),
      },
    },
    mrtTheme: {
      baseBackgroundColor: getColor(Colors.neutral600),
    },
    muiTablePaperProps: { elevation: 0, sx: { borderRadius: "10px" } },
    displayColumnDefOptions: { "mrt-row-expand": { size: 10 } },
    state: { density: "spacious" },
  });

  return <MaterialReactTable table={table} />;
};

export default SimulatedTransactionTable;

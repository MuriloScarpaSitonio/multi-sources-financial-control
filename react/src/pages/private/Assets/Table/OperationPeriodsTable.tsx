import { useMemo } from "react";

import {
    MaterialReactTable,
    type MRT_ColumnDef as Column,
} from "material-react-table";

import { Colors, FontSizes, getColor, getFontSize } from "../../../../design-system";
import useTable from "../../../../hooks/useTable";
import { RawDateString } from "../../../../types";
import { getAssetOperationPeriods } from "../api";
import { OperationPeriod } from "../api/models";
import { ASSETS_QUERY_KEY } from "./consts";
import { getExpandedRowSubTableLayoutProps } from "./utils";

const formatDate = (date: RawDateString): string => {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
};

const OperationPeriodsTable = ({
    assetId,
    currentRoi,
}: {
    assetId: number;
    currentRoi: number;
}) => {
    const columns = useMemo<Column<OperationPeriod>[]>(
        () => [
            {
                header: "Início",
                accessorKey: "started_at",
                enableSorting: false,
                Cell: ({ cell }) => formatDate(cell.getValue<RawDateString>()),
            },
            {
                header: "Fim",
                accessorKey: "closed_at",
                enableSorting: false,
                Cell: ({ cell }) => {
                    const value = cell.getValue<RawDateString | null>();
                    return value ? formatDate(value) : "Até hoje";
                },
            },
            {
                header: "ROI",
                accessorKey: "roi",
                enableSorting: false,
                Cell: ({ cell }) => {
                    const roi = cell.getValue<number>();
                    const roiValue = roi.toLocaleString("pt-br", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    return (
                        <span
                            style={{
                                color: roi > 0 ? getColor(Colors.brand) : getColor(Colors.danger200),
                            }}
                        >
                            {`R$ ${roiValue}`}
                        </span>
                    );
                },
                Footer: ({ table }) => {
                    const rows = table.getRowModel().rows;
                    const total = rows.reduce((sum, row) => sum + row.original.roi!, 0);
                    const totalValue = total.toLocaleString("pt-br", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    return (
                        <span
                            style={{
                                color: total > 0 ? getColor(Colors.brand) : getColor(Colors.danger200),
                                fontWeight: "bold",
                            }}
                        >
                            {`R$ ${totalValue}`}
                        </span>
                    );
                },
            },
        ],
        [],
    );

    const { table } = useTable({
        ...getExpandedRowSubTableLayoutProps(),
        columns: columns as Column<any>[],
        queryKey: [ASSETS_QUERY_KEY, assetId.toString(), "operation_periods"],
        queryFn: async () => {
            const data = await getAssetOperationPeriods(assetId);
            const results = data.map((period) =>
                period.roi === null ? { ...period, roi: currentRoi } : period,
            );
            return { results, count: results.length };
        },
        localization: {
            noRecordsToDisplay: "Nenhum período encontrado",
        },
        muiTableFooterRowProps: ({ table }) => ({
            sx: {
                display: table.getRowModel().rows.length <= 1 ? "none" : undefined,
            },
        }),
        muiTableFooterCellProps: {
            sx: { fontSize: getFontSize(FontSizes.SMALL) },
        },
    });

    return <MaterialReactTable table={table} />;
};

export default OperationPeriodsTable;


import type { ApiListResponse, RawDateString } from "../../../../types";

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
import { getRevenues } from "../api";
import { Revenue } from "../models";

import { REVENUES_QUERY_KEY } from "../consts";
import { ExpensesContext } from "../../Expenses/context";
import { useInvalidateRevenuesQueries } from "../hooks";
import DeleteRevenueDialog from "./DeleteRevenueDialog";
import TopToolBar from "./ToopToolBar";
import { useHideValues } from "../../../../hooks/useHideValues";
import RevenueDrawer from "./RevenueDrawer";
import { removeProperties } from "../../../../utils";

type GroupedRevenue = Revenue & { type: string };

const getRevenuesGroupedByType = async (filters: {
  startDate: Date;
  endDate: Date;
  page?: number;
  page_size?: number;
  ordering?: string;
  description?: string;
}): Promise<ApiListResponse<GroupedRevenue>> => {
  const [Revenues, fixedRevenues] = await Promise.all([
    getRevenues({
      ...filters,
      is_fixed: false,
      page: 1,
      page_size: 100,
    }),
    getRevenues({ ...filters, is_fixed: true, page: 1, page_size: 100 }),
  ]);

  return {
    results: [
      ...fixedRevenues?.results?.map((obj: Revenue) => ({
        ...obj,
        type: "Receitas fixas",
      })),
      ...Revenues?.results?.map((obj: Revenue) => ({ ...obj, type: "Outras" })),
    ],
    count: Revenues?.count,
  };
};

const useOnRevenueDeleteSuccess = () => {
  const queryClient = useQueryClient();
  const { invalidate: invalidateRevenuesQueries } =
    useInvalidateRevenuesQueries(queryClient);

  const removeRevenueFromCachedData = (RevenueId: number) => {
    const revenuesData = queryClient.getQueriesData({
      queryKey: [REVENUES_QUERY_KEY],
      type: "active",
    });
    revenuesData.forEach(([queryKey]) => {
      queryClient.setQueryData(
        queryKey,
        (oldData: ApiListResponse<GroupedRevenue>) => ({
          ...oldData,
          count: oldData.count - 1,
          results: oldData.results.filter(
            (Revenue) => Revenue.id !== RevenueId,
          ),
        }),
      );
    });
  };
  return {
    onDeleteSuccess: async (RevenueId: number) => {
      await invalidateRevenuesQueries({ invalidateTableQuery: false });
      removeRevenueFromCachedData(RevenueId);
    },
  };
};

const Table = () => {
  const [deleteRevenue, setDeleteRevenue] = useState<
    GroupedRevenue | undefined
  >();
  const [editRevenue, setEditRevenue] = useState<GroupedRevenue | undefined>();

  const { startDate, endDate, isRelatedEntitiesLoading, revenuesCategories } =
    useContext(ExpensesContext);

  const { hideValues } = useHideValues();

  const columns = useMemo<Column<GroupedRevenue>[]>(
    () => [
      { header: "", accessorKey: "type", size: 25 },
      {
        header: "Descrição",
        accessorKey: "full_description",
        size: 100,
      },
      {
        header: "Valor",
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
          <Text weith={FontWeights.SEMI_BOLD} size={FontSizes.SMALL}>
            {hideValues
              ? ""
              : `R$ ${cell.getValue<number>().toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </Text>
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
                color={revenuesCategories.hexColorMapping.get(category)}
              />
              <span>{category}</span>
            </Stack>
          );
        },
      },
    ],
    [revenuesCategories, hideValues],
  );

  const { onDeleteSuccess } = useOnRevenueDeleteSuccess();
  const {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    filters,
  } = useTable({
    columns: columns as Column<any>[],
    queryKey: [
      REVENUES_QUERY_KEY,
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
    initialState: {
      grouping: ["type"],
      expanded: { "type:Outras": true, "type:Receitas fixas": true },
    },
    localization: { noRecordsToDisplay: "Nenhuma receita encontrada" },
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
      getRevenuesGroupedByType({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering:
          sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "-created_at",
        description: search,
        startDate,
        endDate,
        ...filters,
      }),
    getRowId: (row: Revenue) => row.id?.toString(),
    renderTopToolbar: ({ table }) => (
      <TopToolBar
        search={search}
        table={table}
        setSearch={setSearch}
        setPagination={setPagination}
      />
    ),
    renderRowActions: ({ row, table }) => (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Editar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setEditRevenue(row.original)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Deletar">
          <IconButton
            sx={{ color: getColor(Colors.neutral300) }}
            onClick={() => setDeleteRevenue(row.original)}
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
      <DeleteRevenueDialog
        revenue={deleteRevenue as GroupedRevenue}
        open={!!deleteRevenue}
        onClose={() => setDeleteRevenue(undefined)}
        onSuccess={onDeleteSuccess}
      />
      <RevenueDrawer
        open={!!editRevenue}
        onClose={() => setEditRevenue(undefined)}
        revenue={
          removeProperties(editRevenue, ["type", "full_description"]) as Revenue
        }
      />
    </>
  );
};

export default Table;

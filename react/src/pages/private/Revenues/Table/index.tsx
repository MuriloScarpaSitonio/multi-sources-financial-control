import { isAxiosError } from "axios";
import {
  getFullHistoryOrdering,
  getSearchDateControls,
  type FullHistoryTableProps,
  type SearchFields,
} from "../../Expenses/fullHistorySearch";
import type { ApiListResponse, RawDateString } from "../../../../types";

import { useContext, useEffect, useMemo, useState } from "react";

import { startOfMonth } from "date-fns";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

import { useQueryClient } from "@tanstack/react-query";
import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  getFontSize,
  getFontWeight,
  Text,
} from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import useTable from "../../../../hooks/useTable";
import { getRevenues } from "../api";
import { Revenue } from "../models";

import { useHideValues } from "../../../../hooks/useHideValues";
import { removeProperties } from "../../../../utils";
import { ExpensesContext } from "../../Expenses/context";
import { REVENUES_QUERY_KEY } from "../consts";
import { useInvalidateRevenuesQueries } from "../hooks";
import { customEndOfMonth } from "../../utils";
import DeleteRevenueDialog from "./DeleteRevenueDialog";
import RevenueDrawer from "./RevenueDrawer";
import TopToolBar from "./ToopToolBar";
import { Filters } from "../types";

type TableProps = FullHistoryTableProps<Filters>;

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

const useOnRevenueDeleteSuccess = (isSearch: boolean) => {
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
      if (isSearch) {
        await queryClient.cancelQueries({
          queryKey: [REVENUES_QUERY_KEY, "search"],
        });
        await queryClient.invalidateQueries({
          queryKey: [REVENUES_QUERY_KEY, "search"],
        });
      } else removeRevenueFromCachedData(RevenueId);
    },
  };
};

const defaultFilters: Filters = {};

const Table = (props: TableProps) => {
  const { externalFilters } = props;
  const isSearch = props.mode === "search";
  const scopedFilters = externalFilters.filters as Filters & SearchFields;
  const searchFiltersSetter = externalFilters.setFilters as React.Dispatch<
    React.SetStateAction<Filters & SearchFields>
  >;
  const [deleteRevenue, setDeleteRevenue] = useState<Revenue | undefined>();
  const [editRevenue, setEditRevenue] = useState<Revenue | undefined>();

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isRelatedEntitiesLoading,
    revenuesCategories,
  } = useContext(ExpensesContext);

  const dateFilters = useMemo(() => {
    const now = new Date();
    return {
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      defaultStartDate: startOfMonth(now),
      defaultEndDate: customEndOfMonth(now),
    };
  }, [startDate, setStartDate, endDate, setEndDate]);

  const { hideValues } = useHideValues();

  const columns = useMemo<Column<GroupedRevenue>[]>(
    () => [
      ...(!isSearch ? [{ header: "", accessorKey: "type", size: 25 }] : []),
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
    [revenuesCategories, hideValues, isSearch],
  );

  const { onDeleteSuccess } = useOnRevenueDeleteSuccess(isSearch);
  const {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    queryError,
    filters,
    setFilters,
  } = useTable({
    columns: columns as Column<any>[],
    queryKey: isSearch
      ? [REVENUES_QUERY_KEY, "search"]
      : [
          REVENUES_QUERY_KEY,
          startDate.toLocaleDateString("pt-br"),
          endDate.toLocaleDateString("pt-br"),
        ],
    defaultFilters,
    externalFilters: externalFilters as {
      filters: Record<string, any>;
      setFilters: any;
    },
    initialSearch: props.mode !== "search" ? props.initialSearch : undefined,
    ...(isSearch
      ? {
          externalSearch: {
            value: scopedFilters.description ?? "",
            setValue: (value) =>
              searchFiltersSetter((previous) => ({
                ...previous,
                description:
                  typeof value === "function"
                    ? value(previous.description ?? "")
                    : value,
              })),
          },
          paginationResetKey: JSON.stringify(scopedFilters),
        }
      : {}),
    enableExpanding: !isSearch,
    enableExpandAll: !isSearch,
    enableGrouping: !isSearch,
    manualExpanding: false,
    groupedColumnMode: "remove",
    positionToolbarAlertBanner: isSearch ? "top" : "none",
    defaultPageSize: 100,
    editDisplayMode: "custom",
    enableRowActions: true,
    enableToolbarInternalActions: true,
    isLoading: isRelatedEntitiesLoading,
    positionActionsColumn: "last",
    initialState: isSearch
      ? {}
      : {
          grouping: ["type"],
          expanded: { "type:Outras": true, "type:Receitas fixas": true },
        },
    localization: {
      noRecordsToDisplay: "Nenhuma receita encontrada",
      rowsPerPage: "Receitas por página",
    },
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
      isSearch
        ? getRevenues({
            ...scopedFilters,
            page: pagination.pageIndex + 1,
            page_size: pagination.pageSize,
            ordering: getFullHistoryOrdering(sorting),
          })
        : getRevenuesGroupedByType({
            page: pagination.pageIndex + 1,
            page_size: pagination.pageSize,
            ordering:
              sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ??
              "-created_at",
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
        filters={filters as Filters}
        setFilters={setFilters}
        defaultFilters={defaultFilters}
        dateFilters={dateFilters}
        isSearch={isSearch}
        onOpenSearch={
          props.mode !== "search" && props.onOpenSearch
            ? () => props.onOpenSearch?.(search)
            : undefined
        }
        onBackToOverview={
          props.mode === "search" ? props.onBackToOverview : undefined
        }
        searchDateControls={
          isSearch
            ? getSearchDateControls(scopedFilters, searchFiltersSetter)
            : undefined
        }
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

  useEffect(() => {
    if (
      isSearch &&
      pagination.pageIndex > 0 &&
      isAxiosError(queryError) &&
      queryError.response?.status === 404 &&
      queryError.response.data?.detail === "Invalid page."
    ) {
      setPagination((previous) => ({
        ...previous,
        pageIndex: Math.max(0, previous.pageIndex - 1),
      }));
    }
  }, [isSearch, queryError, pagination.pageIndex, setPagination]);

  return (
    <>
      <MaterialReactTable table={table} />
      <DeleteRevenueDialog
        revenue={deleteRevenue as Revenue}
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

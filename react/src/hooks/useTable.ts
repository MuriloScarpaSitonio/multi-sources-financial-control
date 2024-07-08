import { useState } from "react";

import { useQuery, type QueryFunction } from "@tanstack/react-query";
import {
  useMaterialReactTable,
  type MRT_ExpandedState as ExpandedState,
  type MRT_PaginationState as PaginationState,
  type MRT_SortingState as SortingState,
  type MRT_TableOptions as TableOptions,
  type MRT_VisibilityState as VisibilityState,
} from "material-react-table";
import { MRT_Localization_PT_BR } from "material-react-table/locales/pt-BR";

import { Colors, getColor } from "../design-system";
import { type ApiListResponse } from "../pages/private/Assets/api/types";

interface TableProps extends TableOptions<any> {
  queryFn: QueryFunction<ApiListResponse<any>>;
  queryKey: string;
  defaultPageSize?: number;
  defaultFilters?: Record<string, any>;
  columnVisibility?: VisibilityState;
}

const useTable = ({
  defaultPageSize = 10,
  defaultFilters = {},
  columnVisibility,
  ...rest
}: Omit<TableProps, "data">) => {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [filters, setFilters] = useState(defaultFilters);

  const { queryFn, queryKey, ...props } = rest;
  const {
    data: { results = [], count = 0 } = {},
    isPending,
    isRefetching,
    isError,
  } = useQuery({
    queryKey: [
      queryKey,
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      search,
      filters,
    ],
    queryFn,
  });

  const table = useMaterialReactTable({
    data: results,
    enableDensityToggle: true,
    enableFullScreenToggle: true,
    enableColumnDragging: true,
    enableColumnOrdering: true,
    enableHiding: true,
    enableExpandAll: false,
    enableColumnActions: false,
    enableFilters: false,
    enableColumnPinning: false,
    enableColumnResizing: false,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    manualExpanding: true,
    muiTableHeadCellProps: {
      sx: { backgroundColor: getColor(Colors.neutral900) },
    },
    muiDetailPanelProps: {
      sx: { backgroundColor: getColor(Colors.neutral600) },
    },
    muiLinearProgressProps: {
      sx: { backgroundColor: getColor(Colors.brand) },
    },
    mrtTheme: {
      baseBackgroundColor: getColor(Colors.neutral900),
      menuBackgroundColor: getColor(Colors.neutral600),
      draggingBorderColor: getColor(Colors.brand),
    },
    muiTablePaperProps: { sx: { borderRadius: "10px" } },
    paginationDisplayMode: "pages",
    muiPaginationProps: {
      rowsPerPageOptions: [
        defaultPageSize,
        defaultPageSize * 2,
        defaultPageSize * 5,
        100,
      ],
    },
    rowCount: count,
    localization: {
      ...MRT_Localization_PT_BR,
      rowsPerPage: "Mostrar",
      expand: "",
    },
    displayColumnDefOptions: { "mrt-row-expand": { size: 10 } },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    state: {
      isLoading: isPending,
      showProgressBars: isRefetching,
      showLoadingOverlay: false,
      pagination,
      sorting,
      expanded,
      showAlertBanner: isError,
      columnVisibility,
    },
    ...props,
  });

  return {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    expanded,
    filters,
    setFilters,
  };
};

export default useTable;

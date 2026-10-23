import { useState, type Dispatch, type SetStateAction } from "react";

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
import { type ApiListResponse } from "../types";

interface ExternalFilters {
  filters: Record<string, any>;
  setFilters:
    | Dispatch<SetStateAction<Record<string, any>>>
    | ((filters: Record<string, any>) => void);
}

interface TableProps extends TableOptions<any> {
  queryFn: QueryFunction<ApiListResponse<any>>;
  queryKey: string[];
  defaultPageSize?: number;
  defaultFilters?: Record<string, any>;
  columnVisibility?: VisibilityState;
  isLoading?: boolean;
  externalFilters?: ExternalFilters;
  initialSearch?: string;
  externalSearch?: {
    value: string;
    setValue: Dispatch<SetStateAction<string>>;
  };
  paginationResetKey?: string;
}

const useTable = ({
  defaultPageSize = 10,
  defaultFilters = {},
  isLoading = false,
  columnVisibility,
  externalFilters,
  initialSearch = "",
  externalSearch,
  paginationResetKey,
  ...rest
}: Omit<TableProps, "data">) => {
  const [internalSearch, setInternalSearch] = useState(initialSearch);
  const search = externalSearch?.value ?? internalSearch;
  const setSearch = externalSearch?.setValue ?? setInternalSearch;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [previousResetKey, setPreviousResetKey] = useState(paginationResetKey);
  const effectivePagination =
    paginationResetKey !== undefined && previousResetKey !== paginationResetKey
      ? { ...pagination, pageIndex: 0 }
      : pagination;
  if (
    paginationResetKey !== undefined &&
    previousResetKey !== paginationResetKey
  ) {
    setPreviousResetKey(paginationResetKey);
    setPagination(effectivePagination);
  }
  const [expanded, setExpanded] = useState<ExpandedState>(
    rest.initialState?.expanded ?? {},
  );
  const [internalFilters, setInternalFilters] = useState(defaultFilters);

  // Use external filters if provided, otherwise use internal state
  const filters = externalFilters?.filters ?? internalFilters;
  const setFilters = externalFilters?.setFilters ?? setInternalFilters;

  const { queryFn, queryKey, ...props } = rest;
  const {
    data: { results = [], count = 0 } = {},
    isPending,
    isRefetching,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: [
      ...queryKey,
      effectivePagination.pageIndex,
      effectivePagination.pageSize,
      sorting,
      search,
      filters,
    ],
    queryFn,
    ...(paginationResetKey !== undefined
      ? { staleTime: 0, refetchOnMount: true, retry: false }
      : {}),
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
    muiTablePaperProps: { sx: { borderRadius: "12px" } },
    paginationDisplayMode: "pages",
    muiPaginationProps: {
      rowsPerPageOptions: [10, 20, 50, 100],
    },
    rowCount: count,
    localization: {
      ...MRT_Localization_PT_BR,
      rowsPerPage: "Mostrar",
      expand: "",
      ...props.localization,
    },
    displayColumnDefOptions: { "mrt-row-expand": { size: 10 } },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    state: {
      isLoading: isPending || isLoading,
      showProgressBars: isRefetching,
      showLoadingOverlay: false,
      pagination: effectivePagination,
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
    pagination: effectivePagination,
    queryError,
    setPagination,
    sorting,
    expanded,
    filters,
    setFilters,
    defaultFilters,
  };
};

export default useTable;

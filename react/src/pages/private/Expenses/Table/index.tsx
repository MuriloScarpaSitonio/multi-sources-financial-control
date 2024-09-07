import type { Dispatch, SetStateAction } from "react";

import type { RawDateString } from "../../../../types";
import type { Filters } from "../types";

import { useMemo, useState, useEffect, useCallback } from "react";

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import {
  MaterialReactTable,
  type MRT_ColumnDef as Column,
} from "material-react-table";
import { format, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

import {
  Text,
  FontSizes,
  FontWeights,
  getFontWeight,
  getFontSize,
  Colors,
  getColor,
} from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import useTable from "../../../../hooks/useTable";
import { getExpenses } from "../api/expenses";
import { Expense } from "../api/models";

import { ExpensesCategoriesMapping, EXPENSES_QUERY_KEY } from "../consts";
// import AssetsForm from "./AssetForm";
import TopToolBar from "./ToopToolBar";

const getExpensesGroupedByType = async (
  filters: Filters & {
    page?: number;
    page_size?: number;
    ordering?: string;
    description?: string;
  },
) => {
  const [expenses, fixedExpenses, expensesWInstallments] = await Promise.all([
    getExpenses({
      ...filters,
      is_fixed: false,
      with_installments: false,
    }),
    getExpenses({ ...filters, is_fixed: true, page: 1, page_size: 100 }),
    getExpenses({
      ...filters,
      with_installments: true,
      page: 1,
      page_size: 100,
    }),
  ]);

  return {
    results: [
      ...fixedExpenses?.results?.map((obj: Expense) => ({
        ...obj,
        type: "Custos fixos",
      })),
      ...expensesWInstallments?.results?.map((obj: Expense) => ({
        ...obj,
        type: "Parcelas",
      })),
      ...expenses?.results?.map((obj: Expense) => ({ ...obj, type: "Outros" })),
    ],
    count: expenses?.count,
  };
};

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Month = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | undefined;

const MonthChips = ({
  month,
  setMonth,
  year,
  setYear,
  currentYear,
}: {
  month: Month;
  setMonth: Dispatch<SetStateAction<Month>>;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  currentYear: number;
}) => {
  const chips = useMemo(
    () =>
      [...Array(12).keys()].map((value) => (
        <Chip
          label={months[value]}
          onClick={value === month ? undefined : () => setMonth(value as Month)}
          variant={value === month ? "neutral-selected" : "neutral"}
        />
      )),
    [setMonth, month],
  );
  const yearDiff = currentYear - year - 1;
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Chip
        label={year - 1}
        onClick={() => setYear((year) => year - 1)}
        icon={<ArrowBackIosIcon fontSize="small" />}
        variant="brand"
      />
      <Chip label={year} clickable={false} variant="brand-selected" />
      {chips}
      {yearDiff >= 0 && (
        <Chip
          label={currentYear - yearDiff}
          onDelete={() => setYear(currentYear - yearDiff)}
          onClick={() => setYear(currentYear - yearDiff)}
          deleteIcon={<ArrowForwardIosIcon fontSize="small" />}
          variant="brand"
        />
      )}
    </Stack>
  );
};
const isFilteringFirstMonth = (startDate: Date, endDate: Date) =>
  isEqual(
    // is the selected date the first day of month?
    new Date(endDate.getFullYear(), endDate.getMonth(), 1),
    startDate,
  ) &&
  isEqual(
    // is the selected date the last day of month?
    new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0),
    endDate,
  );

const Table = () => {
  const today = new Date();
  const [month, setMonth] = useState<Month>(today.getMonth() as Month);
  const [year, setYear] = useState<number>(today.getFullYear());
  const columns = useMemo<Column<Expense>[]>(
    () => [
      { header: "", accessorKey: "type", size: 25 },
      {
        header: "Descrição",
        accessorKey: "full_description",
        size: 100,
      },
      {
        header: "Preço",
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
        AggregatedCell: ({ cell }) => {
          return (
            <Text
              weith={FontWeights.SEMI_BOLD}
              size={FontSizes.SMALL}
            >{`R$ ${cell.getValue<number>().toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}</Text>
          );
        },
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
          const { color } =
            ExpensesCategoriesMapping[
              category as keyof typeof ExpensesCategoriesMapping
            ];
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusDot variant="custom" color={color} />
              <span>{category}</span>
            </Stack>
          );
        },
      },
    ],
    [],
  );

  const {
    table,
    search,
    setSearch,
    pagination,
    setPagination,
    sorting,
    filters,
    setFilters,
  } = useTable({
    columns: columns as Column<any>[],
    queryKey: [EXPENSES_QUERY_KEY],
    enableExpanding: true,
    enableExpandAll: true,
    enableGrouping: true,
    manualExpanding: false,
    groupedColumnMode: "remove",
    positionToolbarAlertBanner: "none",
    defaultPageSize: 100,
    initialState: { grouping: ["type"], expanded: { "type:Outros": true } },
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
      getExpensesGroupedByType({
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        ordering: sorting.map((s) => (s.desc ? `-${s.id}` : s.id))[0] ?? "",
        description: search,
        ...(filters as Filters),
      }),
    getRowId: (row: Expense) => row.id?.toString(),
    renderTopToolbar: ({ table }) => (
      <TopToolBar
        table={table}
        setSearch={setSearch}
        setPagination={setPagination}
        filters={filters as Filters}
        setFilters={setFilters}
        onDateFiltering={() => setMonth(undefined)}
      />
    ),
  });

  useEffect(() => {
    const { start_date, end_date } = filters as Filters;
    if (
      month === undefined &&
      start_date &&
      end_date &&
      isFilteringFirstMonth(start_date, end_date)
    )
      setMonth(start_date.getMonth() as Month);
    if (month !== undefined)
      setFilters((prevFilters) => ({
        ...prevFilters,
        start_date: new Date(year, month, 1), // first day of month
        end_date: new Date(year, month + 1, 0), // last day of month
      }));
  }, [filters, month, setMonth, year, setFilters]);

  const getPeriod = useCallback(() => {
    const { start_date, end_date } = filters as Filters;
    if (!start_date || !end_date) return <Skeleton width={300} />;
    if (isFilteringFirstMonth(start_date, end_date))
      return months[start_date.getMonth()];
    return `${format(start_date, "MMM dd, yyyy", {
      locale: ptBR,
    })} - ${format(end_date, "MMM dd, yyyy", {
      locale: ptBR,
    })}`;
  }, [filters]);

  return (
    <Stack
      spacing={2}
      sx={{ p: 2, backgroundColor: getColor(Colors.neutral900) }}
    >
      <Stack spacing={2} alignItems="center">
        <Text size={FontSizes.LARGE} weight={FontWeights.BOLD}>
          {getPeriod()}
        </Text>
        <MonthChips
          month={month}
          setMonth={setMonth}
          year={year}
          setYear={setYear}
          currentYear={today.getFullYear()}
        />
      </Stack>
      <MaterialReactTable table={table} />
    </Stack>
  );
};

export default Table;

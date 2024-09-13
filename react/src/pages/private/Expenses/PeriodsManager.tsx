import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { format, Month } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

import { useCallback, useContext, useMemo } from "react";

import { ExpensesContext } from "./context";
import { isFilteringWholeMonth } from "./utils";

import { Text, FontSizes, FontWeights } from "../../../design-system";

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

const MonthChips = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const { month, setMonth, year, setYear, setStartDate, setEndDate } =
    useContext(ExpensesContext);

  const onMonthClick = useCallback(
    (value: number) => {
      setMonth(value as Month);
      setStartDate(new Date(year, value, 1)); // first day of month
      setEndDate(new Date(year, value + 1, 0)); // last day of month
    },
    [setEndDate, setMonth, setStartDate, year],
  );

  const chips = useMemo(
    () =>
      [...Array(12).keys()].map((value) => (
        <Chip
          label={months[value]}
          onClick={value === month ? undefined : () => onMonthClick(value)}
          variant={value === month ? "neutral-selected" : "neutral"}
          key={`month-chip-${value}`}
        />
      )),
    [onMonthClick, month],
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

const PeriodsManager = () => {
  const { startDate, endDate } = useContext(ExpensesContext);

  const getPeriod = useCallback(() => {
    if (isFilteringWholeMonth(startDate, endDate))
      return months[startDate.getMonth()];
    return `${format(startDate, "MMM dd, yyyy", {
      locale: ptBR,
    })} - ${format(endDate, "MMM dd, yyyy", {
      locale: ptBR,
    })}`;
  }, [startDate, endDate]);

  return (
    <Stack spacing={2} alignItems="center">
      <Text size={FontSizes.LARGE} weight={FontWeights.BOLD}>
        {getPeriod()}
      </Text>
      <MonthChips />
    </Stack>
  );
};

export default PeriodsManager;

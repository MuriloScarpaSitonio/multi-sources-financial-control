import type { Context, Dispatch, SetStateAction } from "react";

import { format, Month } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { useCallback, useContext, useEffect, useMemo } from "react";

import Text from "./Text";
import { FontSizes, FontWeights } from "../enums";
import { isFilteringWholeMonth } from "../utils";

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
export interface ContextType {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
  month: Month | undefined;
  setMonth: Dispatch<SetStateAction<Month | undefined>>;
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
}

const MonthChips = ({
  context,
  isFilteringEntireMonth,
}: {
  context: Context<ContextType>;
  isFilteringEntireMonth: boolean;
}) => {
  const {
    month,
    setMonth,
    year,
    setYear,
    startDate,
    setStartDate,
    setEndDate,
  } = useContext(context);

  const isFilteringThisYear = useMemo(
    () => isFilteringEntireMonth && startDate.getFullYear() === year,
    [isFilteringEntireMonth, startDate, year],
  );

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearDiff = currentYear - year - 1;

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
          onClick={
            value === month && isFilteringThisYear
              ? undefined
              : () => onMonthClick(value)
          }
          variant={
            value === month && isFilteringThisYear
              ? "neutral-selected"
              : "neutral"
          }
          key={`month-chip-${value}`}
        />
      )),
    [onMonthClick, month, isFilteringThisYear],
  );

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

const PeriodsManager = ({ context }: { context: Context<ContextType> }) => {
  const { startDate, endDate, setMonth, setYear, setStartDate, setEndDate } =
    useContext(context);

  const isFilteringEntireMonth = useMemo(
    () => isFilteringWholeMonth(startDate, endDate),
    [startDate, endDate],
  );

  useEffect(() => {
    if (!isFilteringEntireMonth) {
      setMonth(undefined);
    }
  });

  const onPreviousMonth = useCallback(() => {
    const currentMonth = startDate.getMonth();
    const currentYear = startDate.getFullYear();
    if (currentMonth === 0) {
      setYear(currentYear - 1);
      setMonth(11);
      setStartDate(new Date(currentYear - 1, 11, 1));
      setEndDate(new Date(currentYear, 0, 0));
    } else {
      setMonth((currentMonth - 1) as Month);
      setStartDate(new Date(currentYear, currentMonth - 1, 1));
      setEndDate(new Date(currentYear, currentMonth, 0));
    }
  }, [startDate, setYear, setMonth, setStartDate, setEndDate]);

  const onNextMonth = useCallback(() => {
    const currentMonth = startDate.getMonth();
    const currentYear = startDate.getFullYear();
    if (currentMonth === 11) {
      setYear(currentYear + 1);
      setMonth(0);
      setStartDate(new Date(currentYear + 1, 0, 1));
      setEndDate(new Date(currentYear + 1, 1, 0));
    } else {
      setMonth((currentMonth + 1) as Month);
      setStartDate(new Date(currentYear, currentMonth + 1, 1));
      setEndDate(new Date(currentYear, currentMonth + 2, 0));
    }
  }, [startDate, setYear, setMonth, setStartDate, setEndDate]);

  const getPeriod = useCallback(() => {
    if (isFilteringWholeMonth(startDate, endDate))
      return `${months[startDate.getMonth()]} ${startDate.getFullYear()}`;
    return `${format(startDate, "MMM dd, yyyy", {
      locale: ptBR,
    })} - ${format(endDate, "MMM dd, yyyy", {
      locale: ptBR,
    })}`;
  }, [startDate, endDate]);

  return (
    <Stack spacing={2} alignItems="center">
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={onPreviousMonth} size="small">
          <ArrowBackIosIcon fontSize="small" />
        </IconButton>
        <Text size={FontSizes.LARGE} weight={FontWeights.BOLD}>
          {getPeriod()}
        </Text>
        <IconButton onClick={onNextMonth} size="small">
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Stack>
      <MonthChips
        context={context}
        isFilteringEntireMonth={isFilteringEntireMonth}
      />
    </Stack>
  );
};

export default PeriodsManager;

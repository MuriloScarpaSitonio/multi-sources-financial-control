import { useMemo, type Dispatch, type SetStateAction } from "react";

import Stack from "@mui/material/Stack";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { endOfMonth } from "date-fns";

type DatesState = {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
  disableFuture?: boolean;
};

type DateView = "day" | "month" | "year";

const DatePickers = ({
  views,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  disableFuture = false,
}: { views: DateView[] } & DatesState) => {
  const maxDate = useMemo(
    () => (disableFuture ? endOfMonth(new Date()) : undefined),
    [disableFuture],
  );
  return (
    <Stack
      direction="row"
      gap={1}
      justifyContent="flex-end"
      sx={{ pr: 2.5, pb: 1 }}
    >
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
        <DatePicker
          label="Início"
          slotProps={{
            textField: { required: true, size: "small", variant: "standard" },
          }}
          value={startDate}
          views={views}
          onChange={(v) => {
            if (v && v <= endDate) setStartDate(v);
          }}
        />
      </LocalizationProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
        <DatePicker
          label="Fim"
          slotProps={{
            textField: { required: true, size: "small", variant: "standard" },
          }}
          value={endDate}
          views={views}
          onChange={(v) => {
            if (v && v >= startDate) setEndDate(v);
          }}
          maxDate={maxDate}
        />
      </LocalizationProvider>
    </Stack>
  );
};

export default DatePickers;

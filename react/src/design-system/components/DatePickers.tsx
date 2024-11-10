import type { Dispatch, SetStateAction } from "react";

import Stack from "@mui/material/Stack";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

type DatesState = {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
};

type DateView = "day" | "month" | "year";

const DatePickers = ({
  views,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: { views: DateView[] } & DatesState) => (
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
      />
    </LocalizationProvider>
  </Stack>
);

export default DatePickers;

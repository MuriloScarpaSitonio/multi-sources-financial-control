import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

import { Controller } from "react-hook-form";

import { ReactHookFormsInputCustomProps } from "./types";

const DateInput = ({
  control,
  name = "operation_date",
  label = "Data",
}: Pick<ReactHookFormsInputCustomProps, "control"> & {
  name?: string;
  label?: string;
}) => (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <DatePicker
          {...field}
          label={label}
          format="dd/MM/yyyy"
          slotProps={{ textField: { required: true, variant: "standard" } }}
        />
      )}
    />
  </LocalizationProvider>
);

export default DateInput;

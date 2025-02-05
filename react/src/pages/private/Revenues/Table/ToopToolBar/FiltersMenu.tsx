import { useContext } from "react";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import { isFilteringWholeMonth, Text } from "../../../../../design-system";
import { ExpensesContext } from "../../../Expenses/context";

const schema = yup.object().shape({
  start_date: yup.date(),
  end_date: yup.date(),
});

export const FiltersMenu = ({
  open,
  onClose,
  anchorEl,
}: {
  open: boolean;
  onClose: () => void;
  anchorEl: null | HTMLElement;
}) => {
  const { startDate, setStartDate, endDate, setEndDate, setMonth } =
    useContext(ExpensesContext);
  const { control } = useForm({
    resolver: yupResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      slotProps={{
        paper: {
          sx: {
            width: "400px",
          },
        },
      }}
    >
      <form>
        <Stack spacing={2} sx={{ p: 2 }}>
          <Text>Filtrar receitas</Text>
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={ptBR}
          >
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  {...field}
                  label="Início"
                  format="dd/MM/yyyy"
                  defaultValue={startDate}
                  slotProps={{ textField: { required: true } }}
                  onChange={(date) => {
                    if (date) {
                      setStartDate(date);
                      if (!isFilteringWholeMonth(date, endDate))
                        setMonth(undefined);
                    }
                  }}
                />
              )}
            />
          </LocalizationProvider>
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={ptBR}
          >
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  {...field}
                  label="Fim"
                  format="dd/MM/yyyy"
                  defaultValue={endDate}
                  slotProps={{ textField: { required: true } }}
                  onChange={(date) => {
                    if (date) {
                      setEndDate(date);
                      if (!isFilteringWholeMonth(startDate, date))
                        setMonth(undefined);
                    }
                  }}
                />
              )}
            />
          </LocalizationProvider>
        </Stack>
      </form>
    </Menu>
  );
};

export default FiltersMenu;

import { useContext, type Dispatch, type SetStateAction } from "react";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import Autocomplete from "@mui/material/Autocomplete";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import { isFilteringWholeMonth, Text } from "../../../../../design-system";
import { ExpensesContext } from "../../../Expenses/context";
import { useBankAccounts } from "../../../Expenses/hooks";

type Filters = {
  bank_account_description?: string;
};

type BankAccountOption = { value: string; label: string } | null;

const schema = yup.object().shape({
  start_date: yup.date(),
  end_date: yup.date(),
  bank_account_description: yup
    .object()
    .shape({ value: yup.string(), label: yup.string() })
    .nullable(),
});

export const FiltersMenu = ({
  open,
  onClose,
  anchorEl,
  setFilters,
}: {
  open: boolean;
  onClose: () => void;
  anchorEl: null | HTMLElement;
  setFilters: Dispatch<SetStateAction<Filters>>;
}) => {
  const { startDate, setStartDate, endDate, setEndDate, setMonth } =
    useContext(ExpensesContext);
  const { data: bankAccountsData } = useBankAccounts();
  const bankAccountOptions = (bankAccountsData?.results ?? []).map((account) => ({
    value: account.description,
    label: account.description,
  }));

  const { control } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      bank_account_description: null,
    },
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
          <Controller
            name="bank_account_description"
            control={control}
            render={({ field }) => (
              <Autocomplete
                {...field}
                options={bankAccountOptions}
                getOptionLabel={(option) => option?.label ?? ""}
                isOptionEqualToValue={({ value: optionValue }, { value }) =>
                  optionValue === value
                }
                filterOptions={(options, state) => {
                  if (!state.inputValue || state.inputValue === field.value?.label) {
                    return options;
                  }
                  return options.filter((option) =>
                    option.label?.toLowerCase().includes(state.inputValue.toLowerCase())
                  );
                }}
                onChange={(_, value) => {
                  field.onChange(value);
                  setFilters((prevFilters) => ({
                    ...prevFilters,
                    bank_account_description: value?.label,
                  }));
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Conta bancária" variant="standard" />
                )}
              />
            )}
          />
        </Stack>
      </form>
    </Menu>
  );
};

export default FiltersMenu;

import { useContext, type Dispatch, type SetStateAction } from "react";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import { AutoCompleteMultiInput } from "../../../../../design-system/components";
import { Text } from "../../../../../design-system";
import { Filters } from "../../types";
import { ExpensesContext } from "../../context";
import { isFilteringWholeMonth } from "../../utils";

type Options = { label: string; value: string }[] | undefined;

const schema = yup.object().shape({
  category: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  source: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  start_date: yup.date(),
  end_date: yup.date(),
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
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    setMonth,
    categories,
    sources,
  } = useContext(ExpensesContext);
  const { control, getValues } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      source: [],
      category: [],
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const { category: selectedCategoris, source: selectedSources } = getValues();

  const handleChange = (
    values: Options,
    name: string,
    onFieldChange: (...event: any[]) => void,
  ) => {
    const map = values?.reduce(
      (acc, e) => acc.set(e.value, (acc.get(e.value) || 0) + 1),
      new Map(),
    );
    if (!values) return;
    const uniqueValues = values.filter((v) => map?.get(v.value) === 1);
    onFieldChange(uniqueValues);
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: uniqueValues.map((v) => v.value),
    }));
  };

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
          <Text>Filtrar despesas</Text>
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
            name="category"
            control={control}
            render={({ field: { value, onChange, name } }) => (
              <AutoCompleteMultiInput
                value={value ? value : []}
                selected={
                  (selectedCategoris as Options)?.map((v) => v.value) ?? []
                }
                onChange={(_, values: Options) =>
                  handleChange(values, name, onChange)
                }
                label="Categoria"
                options={categories.results.map(({ name }) => ({
                  label: name,
                  value: name,
                }))}
              />
            )}
          />
          <Controller
            name="source"
            control={control}
            render={({ field: { value, onChange, name } }) => (
              <AutoCompleteMultiInput
                value={value ? value : []}
                selected={
                  (selectedSources as Options)?.map((v) => v.value) ?? []
                }
                onChange={(_, values: Options) =>
                  handleChange(values, name, onChange)
                }
                label="Fonte"
                options={sources.results.map(({ name }) => ({
                  label: name,
                  value: name,
                }))}
              />
            )}
          />
        </Stack>
      </form>
    </Menu>
  );
};

export default FiltersMenu;

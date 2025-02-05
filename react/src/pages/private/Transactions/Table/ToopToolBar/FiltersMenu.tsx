import { useContext, type Dispatch, type SetStateAction } from "react";

import { ptBR } from "date-fns/locale/pt-BR";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import Stack from "@mui/material/Stack";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import {
  AutoCompleteMultiInput,
  isFilteringWholeMonth,
  Text,
} from "../../../../../design-system";
import { Filters } from "../../types";
import { AssetsTypesMapping } from "../../../Assets/consts";
import { TransactionsContext } from "../../context";
import { removeProperties } from "../../../../../utils";

type Options = { label: string; value: string }[] | undefined;

const schema = yup.object().shape({
  asset_type: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  action: yup.object().shape({ value: yup.string(), label: yup.string() }),
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
  const { startDate, setStartDate, endDate, setEndDate, setMonth } =
    useContext(TransactionsContext);

  const { control, getValues } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      action: {},
      asset_type: [],
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const { asset_type: selectedTypes } = getValues();

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
          <Text>Filtrar transferências</Text>
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
            name="asset_type"
            control={control}
            render={({ field: { value, onChange, name } }) => (
              <AutoCompleteMultiInput
                value={value ? value : []}
                selected={(selectedTypes as Options)?.map((v) => v.value) ?? []}
                onChange={(_, values: Options) =>
                  handleChange(values, name, onChange)
                }
                label="Categoria"
                options={Object.entries(AssetsTypesMapping).map(
                  ([label, { value }]) => ({ label, value }),
                )}
              />
            )}
          />
          <Controller
            name="action"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                row
                onChange={(_, value) => {
                  field.onChange(value);
                  setFilters((prevFilters) => ({
                    ...prevFilters,
                    [field.name]: value,
                  }));
                }}
              >
                <FormControlLabel
                  value="BUY"
                  control={
                    <Radio
                      color="default"
                      size="small"
                      onClick={(e: {
                        target: EventTarget & {
                          value?: string;
                        };
                      }) => {
                        if (e.target?.value === field.value) {
                          field.onChange("");
                          setFilters(
                            (prevFilters) =>
                              removeProperties(prevFilters, [
                                field.name,
                              ]) as Filters,
                          );
                        }
                      }}
                    />
                  }
                  label="Compra"
                />
                <FormControlLabel
                  value="SELL"
                  control={
                    <Radio
                      color="default"
                      size="small"
                      onClick={(e: {
                        target: EventTarget & {
                          value?: string;
                        };
                      }) => {
                        if (e.target?.value === field.value) {
                          field.onChange("");
                          setFilters(
                            (prevFilters) =>
                              removeProperties(prevFilters, [
                                field.name,
                              ]) as Filters,
                          );
                        }
                      }}
                    />
                  }
                  label="Venda"
                />
              </RadioGroup>
            )}
          />
        </Stack>
      </form>
    </Menu>
  );
};

export default FiltersMenu;

import { type Dispatch, type SetStateAction } from "react";

import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Menu from "@mui/material/Menu";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import Stack from "@mui/material/Stack";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import * as yup from "yup";

import {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
} from "../../consts";
import { AutoCompleteMultiInput, Text } from "../../../../../design-system";
import { Filters } from "../types";

type Options = { label: string; value: string }[] | undefined;

const schema = yup.object().shape({
  type: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  sector: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  objective: yup
    .array()
    .of(yup.object().shape({ value: yup.string(), label: yup.string() })),
  status: yup
    .string()
    .required()
    .matches(/(OPENED|CLOSED)/),
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
  const { control, getValues } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      type: [],
      sector: [],
      objective: [],
      status: "OPENED",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const {
    type: selectedTypes,
    objective: selectedObjectives,
    sector: selectedSectors,
  } = getValues();

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
          <Text>Filtrar ativos</Text>
          <Controller
            name="type"
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
            name="sector"
            control={control}
            render={({ field: { value, onChange, name } }) => (
              <AutoCompleteMultiInput
                value={value ? value : []}
                selected={
                  (selectedSectors as Options)?.map((v) => v.value) ?? []
                }
                onChange={(_, values: Options) =>
                  handleChange(values, name, onChange)
                }
                label="Setor"
                options={Object.entries(AssetsSectorsMapping).map(
                  ([label, { value }]) => ({ label, value }),
                )}
              />
            )}
          />
          <Controller
            name="objective"
            control={control}
            render={({ field: { value, onChange, name } }) => (
              <AutoCompleteMultiInput
                value={value ? value : []}
                selected={
                  (selectedObjectives as Options)?.map((v) => v.value) ?? []
                }
                onChange={(_, values: Options) =>
                  handleChange(values, name, onChange)
                }
                label="Objetivo"
                options={Object.entries(AssetsObjectivesMapping)
                  .filter(([key, _]) => key !== "Desconhecido")
                  .map(([label, { value }]) => ({ label, value }))}
              />
            )}
          />
          <FormControl>
            <FormLabel sx={{ mt: 2 }}>Status</FormLabel>
            <Controller
              name="status"
              control={control}
              render={({ field: { value, onChange, name } }) => (
                <RadioGroup
                  aria-labelledby="asset-filters-radio-buttons-group-label"
                  name="asset-filters-radio-buttons-group"
                  row
                  value={value}
                  onChange={(e, value) => {
                    onChange(e);
                    setFilters((prevFilters) => ({
                      ...prevFilters,
                      [name]: value as "OPENED" | "CLOSED",
                    }));
                  }}
                >
                  <FormControlLabel
                    value="OPENED"
                    control={<Radio />}
                    label="Aberto"
                  />
                  <FormControlLabel
                    value="CLOSED"
                    control={<Radio />}
                    label="Fechado"
                  />
                </RadioGroup>
              )}
            />
          </FormControl>
        </Stack>
      </form>
    </Menu>
  );
};

export default FiltersMenu;

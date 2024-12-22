import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import type { ExpenseRelatedEntity } from "../context";
import { FormFeedbackError } from "../../../../design-system";
import { StatusDot } from "../../../../design-system/icons";
import { ReactHookFormsInputCustomProps } from "../../../../design-system/components/forms/types";

const AutoCompleteForRelatedEntities = ({
  entities,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  name = "category",
  label = "Categoria",
}: ReactHookFormsInputCustomProps & {
  entities: ExpenseRelatedEntity[];
  name?: string;
  label?: string;
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <>
        <Autocomplete
          {...field}
          onChange={(_, source) => field.onChange(source)}
          disableClearable
          options={entities.map(({ name, hex_color }) => ({
            label: name,
            value: name,
            hex_color,
          }))}
          getOptionLabel={(option) => option.label}
          renderOption={(props, option) => (
            <MenuItem {...props} key={option.value} value={option.value}>
              <Stack direction="row" gap={1} alignItems="center">
                <StatusDot variant="custom" color={option.hex_color} />
                {option.label}
              </Stack>
            </MenuItem>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              value=""
              error={isFieldInvalid(field)}
              required
              label={label}
              variant="standard"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <StatusDot
                      variant="custom"
                      color={field.value.hex_color as string}
                    />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
        {getFieldHasError(name) && (
          <FormFeedbackError message={getErrorMessage(`${name}.label`)} />
        )}
      </>
    )}
  />
);

export default AutoCompleteForRelatedEntities;

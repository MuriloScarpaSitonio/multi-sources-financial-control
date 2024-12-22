import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import { FormFeedbackError } from "../../../../design-system";
import { ColorsMapping } from "../consts";
import { StatusDot } from "../../../../design-system/icons";
import { ReactHookFormsInputCustomProps } from "../../../../design-system/components/forms/types";
import { SxProps } from "@mui/material";

const AutoCompleteForRelatedEntitiesColors = ({
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  sx,
  excludeValues,
}: ReactHookFormsInputCustomProps & {
  sx?: SxProps;
  excludeValues?: string[];
}) => (
  <Stack gap={1} sx={{ width: "25%", ...sx }}>
    <Controller
      name="hex_color"
      control={control}
      rules={{ required: true }}
      render={({ field }) => (
        <Autocomplete
          {...field}
          onChange={(_, source) => field.onChange(source)}
          disableClearable
          options={Object.entries(ColorsMapping)
            .map(([label, { value }]) => ({
              label,
              value,
            }))
            .filter((option) =>
              excludeValues ? !excludeValues.includes(option.value) : true,
            )}
          getOptionLabel={() => ""}
          filterOptions={(options, state) => {
            return state.inputValue
              ? options.filter(
                  (option) =>
                    option.label
                      .toLowerCase()
                      .indexOf(state.inputValue.toLowerCase()) !== -1,
                )
              : options;
          }}
          isOptionEqualToValue={({ value: optionValue }, { value }) =>
            optionValue === value
          }
          renderOption={(props, option) => (
            <MenuItem
              {...props}
              key={`${option.value}-${option.label}`}
              value={option.value}
            >
              <StatusDot variant="custom" color={option.value} />
            </MenuItem>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              value=""
              error={isFieldInvalid(field)}
              required
              label="Cor"
              variant="standard"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <StatusDot
                      variant="custom"
                      color={field.value.value as string}
                    />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
      )}
    />
    {getFieldHasError("hex_color") && (
      <FormFeedbackError message={getErrorMessage("hex_color")} />
    )}
  </Stack>
);

export default AutoCompleteForRelatedEntitiesColors;

import type { Control } from "react-hook-form";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import { TypesMapping } from "../../consts";
import { FormFeedbackError } from "../../../../../design-system";

const TypesAutoComplete = ({
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: {
  control: Control;
  isFieldInvalid: (field: { name: string }) => boolean;
  getFieldHasError: (name: string) => boolean;
  getErrorMessage: (name: string, propName?: string) => string;
}) => (
  <Controller
    name="type"
    control={control}
    render={({ field }) => (
      <>
        <Autocomplete
          {...field}
          onChange={(_, type) => field.onChange(type)}
          disableClearable
          options={Object.entries(TypesMapping).map(([label, { value }]) => ({
            label,
            value,
          }))}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => (
            <TextField
              {...params}
              error={isFieldInvalid(field)}
              required
              label="Categoria"
              variant="standard"
            />
          )}
        />
        {getFieldHasError("type") && (
          <FormFeedbackError message={getErrorMessage("type.label")} />
        )}
      </>
    )}
  />
);

export default TypesAutoComplete;

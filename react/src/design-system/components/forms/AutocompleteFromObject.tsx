import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { Controller } from "react-hook-form";

import { ReactHookFormsInputCustomProps } from "./types";
import FormFeedbackError from "../FormFeedbackError";

const AutocompleteFromObject = ({
  obj,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  name = "category",
  label = "Categoria",
}: ReactHookFormsInputCustomProps & {
  obj: { [label: string]: { value: string } };
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
          options={Object.entries(obj).map(([label, { value }]) => ({
            label,
            value,
          }))}
          getOptionLabel={(option) => option.label}
          renderInput={(params) => (
            <TextField
              {...params}
              error={isFieldInvalid(field)}
              required
              label={label}
              variant="standard"
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

export default AutocompleteFromObject;

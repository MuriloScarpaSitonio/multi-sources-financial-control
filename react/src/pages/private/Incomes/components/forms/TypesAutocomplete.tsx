import type { Control } from "react-hook-form";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import { FormFeedbackError } from "../../../../../design-system";
import { incomeTypeOptionsForAssetType } from "../../incomeTypeOptions";

const TypesAutoComplete = ({
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  assetType,
}: {
  control: Control;
  isFieldInvalid: (field: { name: string }) => boolean;
  getFieldHasError: (name: string) => boolean;
  getErrorMessage: (name: string, propName?: string) => string;
  assetType?: string;
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
          options={incomeTypeOptionsForAssetType(assetType)}
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

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import FormFeedbackError from "../FormFeedbackError";
import NumberFormat from "../NumberFormat";
import { ReactHookFormsInputCustomProps } from "./types";

const PriceWithCurrencyInput = ({
  currencySymbol,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  name = "price",
  label = "Preço",
}: ReactHookFormsInputCustomProps & {
  currencySymbol: string;
  name?: string;
  label?: string;
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Stack spacing={0.5}>
        <TextField
          {...field}
          required
          label={label}
          InputProps={{
            inputComponent: NumberFormat,
            inputProps: { prefix: currencySymbol + " " },
          }}
          error={isFieldInvalid(field)}
          variant="standard"
        />
        {getFieldHasError(name) && (
          <FormFeedbackError message={getErrorMessage(name)} />
        )}
      </Stack>
    )}
  />
);

export default PriceWithCurrencyInput;

import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";

import AmountCalculator from "./AmountCalculator";
import FormFeedbackError from "../FormFeedbackError";
import NumberFormat from "../NumberFormat";
import { ReactHookFormsInputCustomProps } from "./types";

const PriceWithCurrencyInput = ({
  currencySymbol,
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
  withCalculator = false,
  name = "price",
  label = "Preço",
}: ReactHookFormsInputCustomProps & {
  currencySymbol: string;
  withCalculator?: boolean;
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
            endAdornment: withCalculator && (
              <InputAdornment position="end">
                <AmountCalculator
                  value={field.value}
                  onApply={field.onChange}
                />
              </InputAdornment>
            ),
            inputComponent: NumberFormat,
            inputProps: { prefix: currencySymbol + " " },
          }}
          InputLabelProps={{ shrink: true }}
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

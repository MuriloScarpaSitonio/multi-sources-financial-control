import { type Dispatch, type SetStateAction, useEffect } from "react";
import type { AssetCurrencies } from "../../../consts";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { Controller } from "react-hook-form";
import * as yup from "yup";

import {
  FormFeedbackError,
  NumberFormat,
  PriceWithCurrencyInput,
} from "../../../../../../design-system/components";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import { simulateTransaction } from "../../../api";
import { SimulatedAssetResponse } from "../../../api/types";
import { FormData } from "./types";
import {
  AssetCodeAutoComplete,
  TransactionQuantity,
} from "../../../forms/components";
import { AssetCurrencyMap } from "../../../consts";

const schema = yup.object().shape(
  {
    asset: yup
      .object()
      .shape({
        label: yup.string().required("O ativo é obrigatório"),
        value: yup.string(),
        currency: yup.string(),
      })
      .required("O ativo é obrigatório"),
    price: yup
      .number()
      .required("O preço é obrigatório")
      .positive("Apenas números positivos"),
    quantity: yup
      .number()
      .positive("Apenas números positivos")
      .test(
        "QuantityOrTotal",
        "Se 'Total' não for inserido, 'Quantidade' é obrigatório",
        // it has to be function definition to use `this`
        function (quantity) {
          const { total } = this.parent;
          return !(!total && !quantity);
        },
      ),
    total: yup
      .number()
      .positive("Apenas números positivos")
      .test(
        "TotalOrQuantity",
        "Se 'Quantidade' não for inserido, 'Total' é obrigatório",
        // it has to be function definition to use `this`
        function (total) {
          const { quantity } = this.parent;
          return !(!quantity && !total);
        },
      ),
  },
  [["total", "quantity"]],
);

const SimulateTransactionForm = ({
  id,
  setResponseData,
  setFormData,
  setIsSubmitting,
  onSuccess,
}: {
  id: string;
  setResponseData: Dispatch<SetStateAction<SimulatedAssetResponse | null>>;
  setFormData: Dispatch<SetStateAction<FormData | null>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  onSuccess: () => void;
}) => {
  const {
    control,
    watch,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    getValues,
  } = useFormPlus({
    mutationFn: simulateTransaction,
    schema,
    defaultValues: {
      asset: {
        label: "",
        value: "",
        currency: "",
      },
    },
    onSuccess: (responseData) => {
      setResponseData(responseData as SimulatedAssetResponse);
      setFormData(getValues());
      onSuccess();
    },
  });
  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const assetObj = watch("asset");
  const currencySymbol =
    AssetCurrencyMap[assetObj?.currency as AssetCurrencies]?.symbol ?? "";
  return (
    <Stack
      id={id}
      spacing={2}
      component="form"
      noValidate
      onSubmit={handleSubmit((data) => {
        const { asset, ...rest } = data;
        mutate({
          assetId: asset.value,
          data: rest,
        });
      })}
    >
      <AssetCodeAutoComplete
        creatable={false}
        filters={{ status: "OPENED" }}
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <PriceWithCurrencyInput
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
        currencySymbol={currencySymbol}
      />
      <TransactionQuantity
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <Controller
        name="total"
        control={control}
        render={({ field }) => (
          <>
            <TextField
              {...field}
              label="Total"
              InputProps={{
                inputComponent: NumberFormat,
                inputProps: { prefix: currencySymbol + " " },
              }}
              InputLabelProps={{ shrink: true }}
              error={isFieldInvalid(field)}
              variant="standard"
            />
            {getFieldHasError("total") && (
              <FormFeedbackError message={getErrorMessage("total")} />
            )}
          </>
        )}
      />
    </Stack>
  );
};

export default SimulateTransactionForm;

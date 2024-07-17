import { type Dispatch, type SetStateAction, useEffect } from "react";

import Autocomplete from "@mui/material/Autocomplete";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import {
  FormFeedbackError,
  NumberFormat,
} from "../../../../../../design-system";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import {
  AssetCurrencies,
  AssetCurrencyMap,
  AssetIncomeEventTypes,
  AssetsIncomeTypesMapping,
} from "../../../consts";
import { createIncome } from "../../../api";
import { useInvalidateAssetsReportsQueries } from "../../../Reports/AssetAggregationReports/hooks";
import {
  useInvalidateAssetsIndicatorsQueries,
  useInvalidateIncomesIndicatorsQueries,
} from "../../../Indicators/hooks";
import {
  AssetCodeAutoComplete,
  DateInput,
  PriceWithCurrencyInput,
} from "../../../forms/components";
import { ASSETS_QUERY_KEY } from "../../consts";
import { Kinds } from "../../../Reports/types";

const schema = yup.object().shape({
  asset: yup
    .object()
    .shape({
      label: yup.string().required("O ativo é obrigatório"),
      value: yup.number(),
      currency: yup.string(),
    })
    .required("O ativo é obrigatório"),
  type: yup
    .object()
    .shape({
      label: yup.string().required("A categoria é obrigatória"),
      value: yup.string(),
    })
    .required("A categoria é obrigatória"),
  event_type: yup.string().required("O tipo de evento é obrigatório"),
  amount: yup
    .number()
    .required("O montante é obrigatório")
    .positive("Apenas números positivos")
    .typeError("Montante inválido"),
  operation_date: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
  current_currency_conversion_rate: yup
    .number()
    .positive("Apenas números positivos")
    .test(
      "DollarConversionRequired",
      "Obrigatório para ativos em dólar",
      // it has to be function definition to use `this`
      function (rate) {
        const { asset } = this.parent;
        if (!rate) return asset.currency !== "USD";
        return true;
      },
    ),
});

const createIncomeMutation = async (data: yup.Asserts<typeof schema>) => {
  const { current_currency_conversion_rate, asset, type, ...rest } = data;
  await createIncome({
    asset_pk: asset.value as number,
    type: type.value as string,
    ...rest,
    ...(asset.currency === AssetCurrencies.USD
      ? { current_currency_conversion_rate }
      : {}),
  });
};

const NewIncomeForm = ({
  id,
  setIsSubmitting,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
}) => {
  const defaultValues = {
    asset: {
      label: "",
      value: 0,
      currency: "",
    },
    type: {
      label: "Dividendo",
      value: AssetsIncomeTypesMapping.Dividendo.value,
    },
    event_type: "CREDITED",
    operation_date: new Date(),
    amount: "",
  };

  const queryClient = useQueryClient();
  const { invalidate: invalidateIncomesIndicatorsQueries } =
    useInvalidateIncomesIndicatorsQueries();
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries();
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries();

  const {
    control,
    handleSubmit,
    reset,
    mutate,
    watch,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
  } = useFormPlus({
    mutationFn: createIncomeMutation,
    schema: schema,
    defaultValues,
    onSuccess: async (_, variables) => {
      if (
        (variables as yup.Asserts<typeof schema>).event_type ===
        AssetIncomeEventTypes.CREDITED
      ) {
        await invalidateAssetsReportsQueries({ kind: Kinds.ROI, opened: true });
        await invalidateAssetsIndicatorsQueries();
        await invalidateIncomesIndicatorsQueries();
      }
      await queryClient.invalidateQueries({
        queryKey: [ASSETS_QUERY_KEY],
      });
      enqueueSnackbar("Rendimento criado com sucesso", {
        variant: "success",
      });
      reset();
    },
  });

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const assetObj = watch("asset");
  const currencySymbol =
    AssetCurrencyMap[assetObj?.currency as AssetCurrencies]?.symbol;

  return (
    <Stack
      spacing={3}
      sx={{ p: 2 }}
      id={id}
      component="form"
      noValidate
      onSubmit={handleSubmit((data: yup.Asserts<typeof schema>) => {
        mutate(data);
      })}
    >
      <AssetCodeAutoComplete
        creatable={false}
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <DateInput control={control} />
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <>
            <Autocomplete
              {...field}
              onChange={(_, type) => field.onChange(type)}
              disableClearable
              options={Object.entries(AssetsIncomeTypesMapping).map(
                ([label, { value }]) => ({ label, value }),
              )}
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
      <FormControl>
        <Controller
          name="event_type"
          control={control}
          render={({ field }) => (
            <RadioGroup {...field} row>
              <FormControlLabel
                value={AssetIncomeEventTypes.CREDITED}
                control={<Radio />}
                label="Creditado"
                defaultChecked
              />
              <FormControlLabel
                value={AssetIncomeEventTypes.PROVISIONED}
                control={<Radio />}
                label="Provisionado"
              />
            </RadioGroup>
          )}
        />
      </FormControl>
      <PriceWithCurrencyInput
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
        currencySymbol={currencySymbol}
        name="amount"
        label="Montante"
      />
      {currencySymbol === AssetCurrencyMap.USD.symbol && (
        <Controller
          name="current_currency_conversion_rate"
          control={control}
          render={({ field }) => (
            <Stack spacing={0.5}>
              <TextField
                {...field}
                required
                label="Cotação do dólar no dia da transação"
                InputProps={{
                  inputComponent: NumberFormat,
                  inputProps: { prefix: AssetCurrencyMap.BRL.symbol + " " },
                }}
                error={isFieldInvalid(field)}
                variant="standard"
              />
              {getFieldHasError("current_currency_conversion_rate") && (
                <FormFeedbackError
                  message={getErrorMessage("current_currency_conversion_rate")}
                />
              )}
            </Stack>
          )}
        />
      )}
    </Stack>
  );
};

export default NewIncomeForm;

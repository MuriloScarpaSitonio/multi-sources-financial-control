import type { Dispatch, SetStateAction } from "react";

import { useCallback, useEffect, useMemo } from "react";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import {
  DateInput,
  FormFeedbackError,
  NumberFormat,
  PriceWithCurrencyInput,
} from "../../../../../design-system";
import useFormPlus from "../../../../../hooks/useFormPlus";
import {
  AssetCurrencies,
  AssetCurrencyMap,
  AssetsTypesMapping,
} from "../../../Assets/consts";
import { createIncome, editIncome } from "../../api";
import {
  AssetCodeAutoComplete,
  AssetCodeTextField,
} from "../../../Assets/forms/components";
import {
  EventTypes,
  EventTypesMapping,
  INCOMES_QUERY_KEY,
  TypesMapping,
} from "../../consts";
import { useOnFormSuccess } from "./hooks";
import TypesAutoComplete from "../forms/TypesAutocomplete";
import EventTypesRadios from "../forms/EventTypesRadios";
import { Income } from "../../types";
import { useQueryClient } from "@tanstack/react-query";
import { ApiListResponse } from "../../../../../types";
import { formatISO } from "date-fns";

const requireAssetSchema = yup
  .object()
  .shape({
    label: yup.string().required("O ativo é obrigatório"),
    value: yup.number(),
    currency: yup.string(),
  })
  .required("O ativo é obrigatório");
const nonRequireAssetSchema = yup.object().shape({
  label: yup.string(),
  value: yup.number(),
  currency: yup.string(),
});
const baseSchema = {
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
        const { asset, event_type } = this.parent;
        console.log(event_type);
        if (!rate)
          return (
            asset.currency !== AssetCurrencies.USD ||
            event_type === EventTypes.PROVISIONED
          );
        return true;
      },
    ),
};

const createSchema = yup.object().shape({
  asset: requireAssetSchema,
  ...baseSchema,
});

const editSchema = yup.object().shape({
  asset: nonRequireAssetSchema,
  ...baseSchema,
});

type Schema = yup.Asserts<typeof createSchema> | yup.Asserts<typeof editSchema>;

const createIncomeMutation = async (data: yup.Asserts<typeof createSchema>) => {
  const { current_currency_conversion_rate, asset, type, ...rest } = data;
  await createIncome({
    asset_pk: asset.value as number,
    type: type.value as string,
    ...rest,
    ...(asset.currency === AssetCurrencies.USD &&
    rest.event_type === EventTypes.CREDITED
      ? { current_currency_conversion_rate }
      : {}),
  });
};
const editIncomeMutation = async (
  data: yup.Asserts<typeof editSchema> & { incomeId?: number },
) => {
  const { current_currency_conversion_rate, asset, type, incomeId, ...rest } =
    data;
  await editIncome({
    id: incomeId as number,
    data: {
      type: type.value as string,
      ...rest,
      ...(asset.currency === AssetCurrencies.USD &&
      rest.event_type === EventTypes.CREDITED
        ? { current_currency_conversion_rate }
        : {}),
    },
  });
};

const CreateOrEditIncomeForm = ({
  id,
  setIsSubmitting,
  variant,
  initialData,
  onEditSuccess,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  onEditSuccess?: () => void;
  variant?: string;
  initialData?: Income;
}) => {
  const isEdit = !!initialData;

  const {
    id: incomeId,
    type,
    event_type,
    operation_date,
    asset,
    ...rest
  } = initialData ?? {};
  const defaultValues = useMemo(() => {
    if (isEdit)
      return {
        asset: {
          label: asset?.code,
          value: asset?.id,
          currency: asset?.currency,
        },
        type: {
          label: type,
          value: TypesMapping[type as Income["type"]].value,
        },
        operation_date: new Date(operation_date + "T00:00"),
        event_type:
          EventTypesMapping[event_type as keyof typeof EventTypesMapping],
        ...rest,
      };
    return {
      asset: {
        label: "",
        value: 0,
        currency: "",
      },
      type: {
        label: "Dividendo",
        value: TypesMapping.Dividendo.value,
      },
      event_type: EventTypes.CREDITED,
      operation_date: new Date(),
      amount: "",
    };
  }, [
    asset?.code,
    asset?.currency,
    asset?.id,
    event_type,
    isEdit,
    operation_date,
    rest,
    type,
  ]);

  const queryClient = useQueryClient();

  const { onSuccess } = useOnFormSuccess({
    variant: variant as unknown as string,
    client: queryClient,
  });

  const updateCachedData = useCallback(
    (data: yup.Asserts<typeof editSchema> & { id: number }) => {
      const { asset, operation_date, type, event_type, ...rest } = data;
      const expensesData = queryClient.getQueriesData({
        queryKey: [INCOMES_QUERY_KEY],
        type: "active",
      });
      expensesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Income>
        ).results.map((income) =>
          income.id === data.id
            ? {
                ...income,
                ...rest,
                type: type.label,
                event_type:
                  EventTypesMapping[
                    event_type as keyof typeof EventTypesMapping
                  ],
                created_at: formatISO(operation_date, {
                  representation: "date",
                }),
              }
            : income,
        );

        queryClient.setQueryData(
          queryKey,
          (oldData: ApiListResponse<Income>) => ({
            ...oldData,
            results: newCachedData,
          }),
        );
      });
    },
    [queryClient],
  );

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
    getValues,
    errors,
  } = useFormPlus({
    mutationFn: isEdit ? editIncomeMutation : createIncomeMutation,
    schema: isEdit ? editSchema : createSchema,
    defaultValues,
    onSuccess: async (_, variables) => {
      onSuccess({
        isCredited: (variables as Schema).event_type === EventTypes.CREDITED,
        invalidateIncomesTableQuery: !isEdit,
      });
      enqueueSnackbar(
        isEdit
          ? "Rendimento editado com sucesso"
          : "Rendimento criado com sucesso",
        {
          variant: "success",
        },
      );
      if (isEdit) {
        updateCachedData({ ...getValues(), id: incomeId });
        onEditSuccess?.();
      } else reset({ ...getValues(), amount: "" });
    },
  });

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const assetObj = watch("asset");
  const isCredited = watch("event_type") === EventTypes.CREDITED;

  const currencySymbol =
    AssetCurrencyMap[(assetObj?.currency || asset?.currency) as AssetCurrencies]
      ?.symbol;

  console.log("errors =", errors);
  return (
    <Stack
      spacing={3}
      sx={{ p: 2 }}
      id={id}
      component="form"
      noValidate
      onSubmit={handleSubmit((data: Schema) => {
        mutate(isEdit ? { ...data, asset, incomeId } : data);
      })}
    >
      {isEdit ? (
        <AssetCodeTextField control={control} />
      ) : (
        <AssetCodeAutoComplete
          creatable={false}
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
          filters={{
            type: [
              AssetsTypesMapping["Ação BR"].value,
              AssetsTypesMapping["Ação EUA"].value,
              AssetsTypesMapping.Cripto.value,
              AssetsTypesMapping.FII.value,
            ],
          }}
        />
      )}
      <DateInput control={control} />
      <TypesAutoComplete
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <EventTypesRadios control={control} />
      <PriceWithCurrencyInput
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
        currencySymbol={currencySymbol}
        name="amount"
        label="Montante"
      />
      {currencySymbol === AssetCurrencyMap.USD.symbol && isCredited && (
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

export default CreateOrEditIncomeForm;

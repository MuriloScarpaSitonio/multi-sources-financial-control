import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import * as yup from "yup";

import {
  DateInput,
  FormFeedbackError,
  NumberFormat,
  PriceWithCurrencyInput,
} from "../../../../../design-system";
import useFormPlus from "../../../../../hooks/useFormPlus";
import { AssetCurrencies, AssetCurrencyMap } from "../../../Assets/consts";
import { editTransaction } from "../../api";
import {
  AssetCodeTextField,
  TransactionQuantity,
} from "../../../Assets/forms/components";
import { TRANSACTIONS_QUERY_KEY } from "../../consts";
import { Transaction } from "../../types";
import { ApiListResponse } from "../../../../../types";
import { formatISO } from "date-fns";
import { useInvalidateTransactionsQueries } from "../hooks";

const schema = yup.object().shape({
  asset: yup.object().shape({
    label: yup.string(),
    value: yup.number(),
    currency: yup.string(),
    is_held_in_self_custody: yup.boolean(),
  }),
  action: yup.string().required("A ação é obrigatória"),
  price: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos")
    .typeError("Preço inválido"),
  quantity: yup
    .number()
    .positive("Apenas números positivos")
    .transform((_, v) => (v === "" ? undefined : v))
    .test(
      "QuantityRequired",
      "A quantidade é obrigatória",
      // it has to be function definition to use `this`
      function (quantity) {
        const { is_held_in_self_custody } = this.parent;
        if (is_held_in_self_custody) {
          return !quantity;
        }
        return !!quantity;
      },
    ),
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
        if (!rate) return asset.currency !== AssetCurrencies.USD;
        return true;
      },
    ),
});

const editTransactionMutation = async ({
  id,
  data,
}: {
  id: number;
  data: yup.Asserts<typeof schema>;
}) => {
  const { current_currency_conversion_rate, asset, ...rest } = data;
  await editTransaction({
    id,
    data: {
      ...rest,
      ...(asset.currency === AssetCurrencies.USD
        ? { current_currency_conversion_rate }
        : {}),
    },
  });
};

const EditTransactionForm = ({
  id,
  setIsSubmitting,
  initialData,
  onEditSuccess,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  initialData?: Transaction;
  onEditSuccess?: () => void;
}) => {
  const {
    id: transactionId,
    action,
    operation_date,
    asset,
    ...rest
  } = initialData ?? {};

  const defaultValues = useMemo(
    () => ({
      ...rest,
      asset: {
        label: asset?.code,
        value: asset?.id,
        currency: asset?.currency,
        is_held_in_self_custody: asset?.is_held_in_self_custody,
      },
      action: action === "Compra" ? "BUY" : "SELL",
      operation_date: new Date(operation_date + "T00:00"),
    }),
    [
      action,
      asset?.code,
      asset?.currency,
      asset?.id,
      asset?.is_held_in_self_custody,
      operation_date,
      rest,
    ],
  );

  const queryClient = useQueryClient();
  const { invalidate: invalidateTransactionsQueries } =
    useInvalidateTransactionsQueries(queryClient);

  const updateCachedData = useCallback(
    (data: yup.Asserts<typeof schema> & { id: number }) => {
      const { asset, operation_date, ...rest } = data;
      const expensesData = queryClient.getQueriesData({
        queryKey: [TRANSACTIONS_QUERY_KEY],
        type: "active",
      });
      expensesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Transaction>
        ).results.map((transaction) =>
          transaction.id === data.id
            ? {
                ...transaction,
                ...rest,
                created_at: formatISO(operation_date, {
                  representation: "date",
                }),
              }
            : transaction,
        );

        queryClient.setQueryData(
          queryKey,
          (oldData: ApiListResponse<Transaction>) => ({
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
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    getValues,
  } = useFormPlus({
    mutationFn: editTransactionMutation,
    schema,
    defaultValues,
    onSuccess: async () => {
      const data = getValues() as yup.Asserts<typeof schema>;
      invalidateTransactionsQueries({
        invalidateReportsQuery: data.action === "BUY",
        invalidateTableQuery: false,
      });

      enqueueSnackbar("Transação editada com sucesso", {
        variant: "success",
      });
      updateCachedData({ ...data, id: transactionId as number });
      onEditSuccess?.();
    },
  });
  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const currencySymbol = useMemo(
    () => (asset?.currency ? AssetCurrencyMap[asset.currency]?.symbol : ""),
    [asset?.currency],
  );

  return (
    <Stack
      spacing={3}
      sx={{ p: 2 }}
      id={id}
      component="form"
      noValidate
      onSubmit={handleSubmit((data: yup.Asserts<typeof schema>) => {
        mutate({ id: transactionId, data: { ...data, asset } });
      })}
    >
      <AssetCodeTextField control={control} />
      <DateInput control={control} />
      <FormControl>
        <Controller
          name="action"
          control={control}
          render={({ field }) => (
            <RadioGroup {...field} row>
              <FormControlLabel
                value="BUY"
                control={<Radio />}
                label="Compra"
                defaultChecked
              />
              <FormControlLabel
                value="SELL"
                control={<Radio />}
                label="Venda"
              />
            </RadioGroup>
          )}
        />
      </FormControl>
      <Stack spacing={1} direction="row">
        <PriceWithCurrencyInput
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
          currencySymbol={currencySymbol}
        />
        <TransactionQuantity
          required
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
          isHeldInSelfCustody={asset?.is_held_in_self_custody}
        />
      </Stack>
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
                InputLabelProps={{ shrink: true }}
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

export default EditTransactionForm;

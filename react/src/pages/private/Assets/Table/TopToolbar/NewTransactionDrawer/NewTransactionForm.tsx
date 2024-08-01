import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

import Divider from "@mui/material/Divider";
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
  FormFeedbackError,
  NumberFormat,
} from "../../../../../../design-system";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import {
  AssetCurrencies,
  AssetCurrencyMap,
  AssetsTypesMapping,
} from "../../../consts";
import { createAsset, createTransaction } from "../../../api";
import { getCurrencyFromType } from "../utils";
import { useInvalidateAssetsReportsQueries } from "../../../Reports/hooks";
import { useInvalidateAssetsIndicatorsQueries } from "../../../Indicators/hooks";
import { useInvalidateAssetsMinimalDataQueries } from "../../../forms/hooks";
import {
  AssetCodeAutoComplete,
  AssetCurrenciesInput,
  AssetObjectives,
  AssetTypeAutoComplete,
  TransactionQuantity,
  PriceWithCurrencyInput,
  DateInput,
} from "../../../forms/components";
import { ASSETS_QUERY_KEY } from "../../consts";

const transactionShape = {
  asset: yup
    .object()
    .shape({
      label: yup.string().required("O ativo é obrigatório"),
      value: yup.number(),
      currency: yup.string(),
    })
    .required("O ativo é obrigatório"),
  action: yup.string().required("A ação é obrigatória"),
  price: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos")
    .typeError("Preço inválido"),
  quantity: yup
    .number()
    .required("A quantidade é obrigatória")
    .positive("Apenas números positivos")
    .typeError("Quantidade inválida"),
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
        const { asset, currency, type } = this.parent;
        if (!rate) {
          if (asset?.currency) return asset.currency !== AssetCurrencies.USD;
          if (type?.value === AssetsTypesMapping.Cripto.value)
            return currency !== AssetCurrencies.USD;
          return type?.value !== AssetsTypesMapping["Ação EUA"].value;
        }
        return true;
      },
    ),
};

const assetShape = {
  type: yup
    .object()
    .shape({
      label: yup.string().required("O tipo é obrigatório"),
      value: yup.string().required("O tipo é obrigatório"),
    })
    .required("O tipo é obrigatório"),
  objective: yup.string().required("O objetivo é obrigatório"),
  currency: yup
    .string()
    .when("$isCrypto", (isCrypto, schema) =>
      isCrypto[0] ? schema.required("A moeda é obrigatória") : schema,
    ),
};

const transactionSchema = yup.object().shape(transactionShape);
const newAssetTransactionSchema = yup
  .object()
  .shape({ ...transactionShape, ...assetShape });

const createTransactionAndAsset = async (
  data: yup.Asserts<typeof newAssetTransactionSchema>,
) => {
  const { objective, type, asset: code, currency, ...transaction } = data;
  const assetCurrency =
    currency ?? (getCurrencyFromType(type.value as string) as string);
  const asset = await createAsset({
    code: code.label as string,
    type: type.value as string,
    currency: assetCurrency,
    objective,
  });

  const { current_currency_conversion_rate, ...rest } = transaction;
  await createTransaction({
    asset_pk: asset.id,
    ...rest,
    ...(assetCurrency === AssetCurrencies.USD
      ? { current_currency_conversion_rate }
      : {}),
  });
};

const createTransactionMutation = async (
  data: yup.Asserts<typeof transactionSchema>,
) => {
  const { current_currency_conversion_rate, asset, ...rest } = data;
  await createTransaction({
    asset_pk: asset.value as number,
    ...rest,
    ...(asset.currency === AssetCurrencies.USD
      ? { current_currency_conversion_rate }
      : {}),
  });
};

const NewTransactionForm = ({
  id,
  setIsSubmitting,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
}) => {
  const [isCrypto, setIsCrypto] = useState(false);
  const [newCode, setNewCode] = useState<string | undefined>("");

  const defaultValues = {
    asset: {
      label: "",
      value: 0,
      currency: "",
    },
    action: "BUY",
    operation_date: new Date(),
    price: "",
    quantity: "",
  };

  const queryClient = useQueryClient();
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries();
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries();
  const { invalidate: invalidateAssetsMinimalDataQueries } =
    useInvalidateAssetsMinimalDataQueries();

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
    mutationFn: newCode ? createTransactionAndAsset : createTransactionMutation,
    schema: newCode ? newAssetTransactionSchema : transactionSchema,
    defaultValues: newCode
      ? {
          ...defaultValues,
          type: { label: "", value: "" },
          objective: "",
          currency: "",
        }
      : defaultValues,
    context: { isCrypto },
    onSuccess: async () => {
      await invalidateAssetsReportsQueries();
      await invalidateAssetsIndicatorsQueries();
      enqueueSnackbar("Transação criada com sucesso", {
        variant: "success",
      });
      await queryClient.invalidateQueries({
        queryKey: [ASSETS_QUERY_KEY],
      });
      if (newCode) {
        setNewCode("");
        await invalidateAssetsMinimalDataQueries();
      }
      reset();
    },
  });

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const assetObj = watch("asset");
  const assetType = watch("type");
  const assetCurrency = watch("currency");

  const getCurrencySymbol = useCallback(() => {
    if (assetObj?.currency)
      return AssetCurrencyMap[assetObj.currency as AssetCurrencies].symbol;
    if (assetCurrency && isCrypto)
      return AssetCurrencyMap[assetCurrency as AssetCurrencies].symbol;
    return AssetCurrencyMap[getCurrencyFromType(assetType?.value)].symbol;
  }, [assetObj, assetCurrency, assetType, isCrypto]);

  const currencySymbol = getCurrencySymbol();

  return (
    <Stack
      spacing={3}
      sx={{ p: 2 }}
      id={id}
      component="form"
      noValidate
      onSubmit={handleSubmit(
        (
          data:
            | yup.Asserts<typeof transactionSchema>
            | yup.Asserts<typeof newAssetTransactionSchema>,
        ) => {
          mutate(data);
        },
      )}
    >
      <AssetCodeAutoComplete
        creatable
        control={control}
        newCode={newCode}
        setNewCode={setNewCode}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
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
      {newCode && (
        <>
          <Divider />
          <AssetObjectives
            prefix="create-transaction"
            control={control}
            isFieldInvalid={isFieldInvalid}
            getFieldHasError={getFieldHasError}
            getErrorMessage={getErrorMessage}
          />
          <AssetTypeAutoComplete
            control={control}
            setIsCrypto={setIsCrypto}
            isFieldInvalid={isFieldInvalid}
            getFieldHasError={getFieldHasError}
            getErrorMessage={getErrorMessage}
          />
          {isCrypto && (
            <AssetCurrenciesInput
              prefix="create-transaction"
              control={control}
              isFieldInvalid={isFieldInvalid}
              getFieldHasError={getFieldHasError}
              getErrorMessage={getErrorMessage}
            />
          )}
        </>
      )}
    </Stack>
  );
};

export default NewTransactionForm;

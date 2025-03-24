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
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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
import { createAsset, updateAssetPrice } from "../../../Assets/api";
import { createTransaction } from "../../api";
import { getCurrencyFromType } from "../../../Assets/Table/TopToolbar/utils";
import { useInvalidateAssetsMinimalDataQueries } from "../../../Assets/forms/hooks";
import {
  AssetCodeAutoComplete,
  AssetCurrenciesInput,
  AssetObjectives,
  AssetTypeAutoComplete,
  TransactionQuantity,
} from "../../../Assets/forms/components";
import { useOnFormSuccess } from "./hooks";

const transactionShape = {
  asset: yup
    .object()
    .shape({
      label: yup.string(),
      value: yup.number(),
      currency: yup.string(),
    })
    .test(
      "AssetRequired",
      "O ativo é obrigatório",
      // it has to be function definition to use `this`
      function (asset) {
        const { is_new_asset_held_in_self_custody } = this.parent;
        if (is_new_asset_held_in_self_custody) {
          return !asset.label;
        }
        return !!asset.label;
      },
    ),
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
        const { is_new_asset_held_in_self_custody, asset } = this.parent;
        if (
          is_new_asset_held_in_self_custody ||
          asset?.is_held_in_self_custody
        ) {
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
  is_new_asset_held_in_self_custody: yup.boolean().default(false),
  asset_description: yup.string(),
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
  const {
    objective,
    type,
    asset: { label: code },
    currency,
    is_new_asset_held_in_self_custody: is_held_in_self_custody,
    asset_description: description,
    ...transaction
  } = data;
  const assetCurrency = currency ?? (getCurrencyFromType(type.value) as string);
  const asset = await createAsset({
    type: type.value,
    currency: assetCurrency,
    objective,
    is_held_in_self_custody,
    description,
    ...(is_held_in_self_custody ? {} : { code }),
  });

  const { current_currency_conversion_rate, quantity, price, ...rest } =
    transaction;
  await createTransaction({
    asset_pk: asset.id,
    price,
    ...rest,
    ...(assetCurrency === AssetCurrencies.USD
      ? { current_currency_conversion_rate }
      : {}),
    ...(is_held_in_self_custody ? {} : { quantity }),
  });
  if (is_held_in_self_custody)
    await updateAssetPrice({ id: asset.id, data: { current_price: price } });
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
  variant,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  variant?: string;
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

  const { invalidate: invalidateAssetsMinimalDataQueries } =
    useInvalidateAssetsMinimalDataQueries();

  const { onSuccess } = useOnFormSuccess(variant as unknown as string);

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
    setValue,
  } = useFormPlus({
    mutationFn: newCode ? createTransactionAndAsset : createTransactionMutation,
    schema: newCode ? newAssetTransactionSchema : transactionSchema,
    defaultValues: newCode
      ? {
          ...defaultValues,
          type: { label: "", value: "" },
          objective: "",
          currency: "",
          asset_description: "",
        }
      : defaultValues,
    context: { isCrypto },
    onSuccess: async () => {
      onSuccess();
      enqueueSnackbar("Transação criada com sucesso", {
        variant: "success",
      });
      if (newCode) {
        setNewCode("");
        await invalidateAssetsMinimalDataQueries();
      }
      reset({
        ...getValues(),
        asset: defaultValues.asset,
        is_new_asset_held_in_self_custody: false,
      });
    },
  });
  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

  const assetObj = watch("asset");
  const assetType = watch("type");
  const assetCurrency = watch("currency");
  const isNewAssetHeldInSelfCustody = watch(
    "is_new_asset_held_in_self_custody",
  );

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
        isNewAssetHeldInSelfCustody={isNewAssetHeldInSelfCustody}
      />
      {newCode && (
        <>
          <AssetTypeAutoComplete
            control={control}
            setIsCrypto={setIsCrypto}
            isFieldInvalid={isFieldInvalid}
            getFieldHasError={getFieldHasError}
            getErrorMessage={getErrorMessage}
          />
          {assetType?.value === AssetsTypesMapping["Renda fixa BR"].value && (
            <Typography component="div">
              <FormLabel>É um ativo custodiado fora da B3?</FormLabel>
              <Grid component="label" container alignItems="center" spacing={1}>
                <Grid item>Não</Grid>
                <Grid item>
                  <Controller
                    name="is_new_asset_held_in_self_custody"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        color="primary"
                        checked={value}
                        onChange={(_, v) => {
                          onChange(v);
                          const {
                            asset: { label: code },
                            asset_description: description,
                          } = getValues();

                          if (v) {
                            if (!description)
                              setValue("asset_description", code);
                            setValue("asset", defaultValues.asset);
                            setValue("quantity", "");
                          } else {
                            if (!code) {
                              setValue("asset", {
                                ...defaultValues.asset,
                                label: description,
                              });
                              setValue("asset_description", "");
                            }
                          }
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item>Sim</Grid>
              </Grid>
            </Typography>
          )}
          <Controller
            name="asset_description"
            control={control}
            render={({ field }) => (
              <Stack spacing={0.5}>
                <TextField
                  {...field}
                  label="Descrição do ativo"
                  error={isFieldInvalid(field)}
                  variant="standard"
                />
                {getFieldHasError("asset_description") && (
                  <FormFeedbackError
                    message={getErrorMessage("asset_description")}
                  />
                )}
              </Stack>
            )}
          />
          <AssetObjectives
            prefix="create-transaction"
            control={control}
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
      {newCode && <Divider />}
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
          isHeldInSelfCustody={
            isNewAssetHeldInSelfCustody || !!assetObj?.is_held_in_self_custody
          }
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
    </Stack>
  );
};

export default NewTransactionForm;

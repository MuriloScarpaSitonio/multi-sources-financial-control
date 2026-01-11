import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { formatISO } from "date-fns";
import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import * as yup from "yup";

import { REVENUES_QUERY_KEY } from "../../consts";
import {
  DateInput,
  FormFeedbackError,
  PriceWithCurrencyInput,
} from "../../../../../design-system";
import useFormPlus from "../../../../../hooks/useFormPlus";
import { createRevenue, editRevenue } from "../../api";
import { useInvalidateRevenuesQueries } from "../../hooks";
import { Revenue } from "../../models";
import { ExpensesContext } from "../../../Expenses/context";
import { ApiListResponse } from "../../../../../types";
import { AutoCompleteForRelatedEntities } from "../../../Expenses/components";
import { useDefaultBankAccount } from "../../../Expenses/hooks";
import Autocomplete from "@mui/material/Autocomplete";

const schema = yup.object().shape({
  description: yup.string().required("A descrição é obrigatória"),
  value: yup
    .number()
    .required("O preço é obrigatório")
    .positive("Apenas números positivos"),
  created_at: yup
    .date()
    .required("A data é obrigatória")
    .typeError("Data inválida"),
  isFixed: yup.boolean().default(false),
  performActionsOnFutureFixedEntities: yup.boolean().default(false),
  category: yup
    .object()
    .shape({
      label: yup.string().required("A categoria é obrigatória"),
      value: yup.string().required("A categoria é obrigatória"),
    })
    .required("A categoria é obrigatória"),
  bank_account_description: yup
    .object()
    .required("A conta bancária é obrigatória")
    .shape({
      label: yup.string(),
      value: yup.string(),
    }),
});

const createRevenueMutation = async (data: yup.Asserts<typeof schema>) => {
  const { isFixed, category, bank_account_description, ...rest } = data;
  await createRevenue({
    is_fixed: isFixed,
    category: category.value as string,
    bank_account_description: bank_account_description.label as string,
    ...rest,
  });
};

const editRevenueMutation = async (
  id: number,
  data: yup.Asserts<typeof schema>,
) => {
  const { isFixed, category, bank_account_description, ...rest } = data;
  await editRevenue({
    id,
    data: {
      is_fixed: isFixed,
      category: category.value as string,
      bank_account_description: bank_account_description.label as string,
      ...rest,
    },
  });
};

const RevenueForm = ({
  id,
  setIsSubmitting,
  setIsDisabled,
  onEditSuccess,
  initialData,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  setIsDisabled?: Dispatch<SetStateAction<boolean>>;
  onEditSuccess?: () => void;
  initialData?: Revenue;
}) => {
  const { revenuesCategories, mostCommonRevenueCategory } = useContext(ExpensesContext);
  const { data: defaultBankAccount, accounts: bankAccounts } = useDefaultBankAccount();

  const {
    id: revenueId,
    category,
    created_at,
    is_fixed,
    bank_account_description: _bankAccountDescription,
    ...rest
  } = initialData ?? {
    is_fixed: false,
    category: mostCommonRevenueCategory?.name ?? "Salário",
  };

  const bankAccountOptions = useMemo(
    () =>
      (bankAccounts ?? []).map((account) => ({
        label: account.description,
        value: account.description,
      })),
    [bankAccounts],
  );

  const defaultBankAccountOption = useMemo(() => {
    if (initialData?.bank_account_description) {
      return { label: initialData.bank_account_description, value: initialData.bank_account_description };
    }
    return defaultBankAccount
      ? { label: defaultBankAccount.description, value: defaultBankAccount.description }
      : null;
  }, [initialData, defaultBankAccount]);

  const defaultValues = useMemo(
    () => ({
      description: "",
      value: "",
      created_at: created_at ? new Date(created_at + "T00:00") : new Date(),
      isFixed: is_fixed,
      category: {
        label: category,
        value: category,
        hex_color: revenuesCategories.hexColorMapping.get(category),
      },
      bank_account_description: defaultBankAccountOption,
      ...rest,
    }),
    [category, created_at, is_fixed, rest, revenuesCategories, mostCommonRevenueCategory, defaultBankAccountOption],
  );

  const queryClient = useQueryClient();
  const { invalidate: invalidateRevenuesQueries } =
    useInvalidateRevenuesQueries(queryClient);

  const updateCachedData = useCallback(
    (data: yup.Asserts<typeof schema> & { id: number }) => {
      const { created_at, category, bank_account_description, ...rest } = data;
      const revenuesData = queryClient.getQueriesData({
        queryKey: [REVENUES_QUERY_KEY],
        type: "active",
      });
      revenuesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Revenue>
        ).results.map((revenue) =>
          revenue.id === data.id
            ? {
                ...revenue,
                ...rest,
                created_at: formatISO(created_at, { representation: "date" }),
                category: category.label,
                bank_account_description: bank_account_description.label,
              }
            : revenue,
        );

        queryClient.setQueryData(
          queryKey,
          (oldData: ApiListResponse<Revenue>) => ({
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
    isPending,
    isDirty,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    watch,
    getValues,
  } = useFormPlus({
    mutationFn: revenueId
      ? (data) => editRevenueMutation(revenueId, data)
      : createRevenueMutation,
    schema: schema,
    defaultValues,
    onSuccess: async () => {
      const data = getValues() as yup.Asserts<typeof schema>;
      await invalidateRevenuesQueries({
        isUpdatingValue: data.value !== defaultValues.value,
        invalidateTableQuery: !revenueId,
      });

      enqueueSnackbar(
        `Receita ${revenueId ? "editada" : "criada"} com sucesso`,
        {
          variant: "success",
        },
      );
      if (revenueId) {
        updateCachedData({ ...data, id: revenueId });
        onEditSuccess?.();
      } else reset({ ...data, description: "", value: "" });
    },
  });
  const isFixed = watch("isFixed");

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);
  useEffect(() => setIsDisabled?.(!isDirty), [isDirty, setIsDisabled]);

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
      <Controller
        name="description"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <TextField
            {...field}
            label="Descrição"
            required
            error={getFieldHasError(field.name)}
            helperText={getErrorMessage(field.name)}
            variant="standard"
          />
        )}
      />
      <Stack direction="row" spacing={1}>
        <PriceWithCurrencyInput
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
          currencySymbol="R$"
          name="value"
          label="Valor"
        />
        <DateInput name="created_at" control={control} />
      </Stack>
      <Stack direction="row" spacing={9} alignItems="center">
        <Typography component="div">
          <FormLabel>Fixa?</FormLabel>
          <Grid component="label" container alignItems="center" spacing={1}>
            <Grid item>Não</Grid>
            <Grid item>
              <Controller
                name="isFixed"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Switch
                    color="primary"
                    checked={value}
                    onChange={(_, v) => {
                      onChange(v);
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item>Sim</Grid>
          </Grid>
        </Typography>
        <Typography
          component="div"
          style={{
            display: isFixed ? "" : "none",
          }}
        >
          <FormLabel>Aplicar em receitas futuras?</FormLabel>
          <Grid component="label" container alignItems="center" spacing={1}>
            <Grid item>Não</Grid>
            <Grid item>
              <Controller
                name="performActionsOnFutureFixedEntities"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Switch
                    color="primary"
                    checked={value}
                    onChange={(_, v) => {
                      onChange(v);
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item>Sim</Grid>
          </Grid>
        </Typography>
      </Stack>
      <AutoCompleteForRelatedEntities
        entities={revenuesCategories.results}
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <Controller
        name="bank_account_description"
        control={control}
        render={({ field }) => (
          <Stack spacing={0.5}>
            <Autocomplete
              {...field}
              disableClearable
              options={bankAccountOptions}
              getOptionLabel={(option) => option?.label ?? ""}
              isOptionEqualToValue={({ value: optionValue }, { value }) =>
                optionValue === value
              }
              onChange={(_, value) => field.onChange(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Conta bancária"
                  required
                  error={isFieldInvalid(field)}
                  variant="standard"
                />
              )}
            />
            {getFieldHasError(field.name) && (
              <FormFeedbackError message={getErrorMessage(field.name)} />
            )}
          </Stack>
        )}
      />
    </Stack>
  );
};

export default RevenueForm;

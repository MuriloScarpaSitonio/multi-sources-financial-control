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
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { useQueryClient } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import { EXPENSES_QUERY_KEY } from "../../consts";

import {
  DateInput,
  FormFeedbackError,
  PriceWithCurrencyInput,
} from "../../../../../design-system";
import useFormPlus from "../../../../../hooks/useFormPlus";
import { ApiListResponse } from "../../../../../types";
import { createExpense, editExpense } from "../../api/expenses";
import { Expense } from "../../api/models";
import { AutoCompleteForRelatedEntities } from "../../components";
import TagsAutoComplete from "../../components/TagsAutoComplete";
import { ExpensesContext } from "../../context";
import { useDefaultBankAccount, useInvalidateExpenseQueries } from "../../hooks";
import Autocomplete from "@mui/material/Autocomplete";

const schema = yup.object().shape({
  description: yup.string().required("A descrição é obrigatória"),
  value: yup
    .number()
    .required("O valor é obrigatório")
    .positive("Apenas números positivos")
    .typeError("O valor é obrigatório"),
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
  source: yup
    .object()
    .shape({
      label: yup.string().required("A fonte é obrigatória"),
      value: yup.string().required("A fonte é obrigatória"),
    })
    .required("A fonte é obrigatória"),
  installments: yup
    .number()
    .required("A quantidade de parcelas é obrigatório")
    .positive("Apenas números positivos"),
  tags: yup.array().of(yup.string().required("Uma tag vazia não é permitida")),
  bank_account_description: yup
    .object()
    .required("A conta bancária é obrigatória")
    .shape({
      label: yup.string(),
      value: yup.string(),
    }),
});

const createExpenseMutation = async (data: yup.Asserts<typeof schema>) => {
  const {
    category,
    source,
    installments,
    isFixed,
    tags,
    performActionsOnFutureFixedEntities,
    bank_account_description,
    ...rest
  } = data;
  await createExpense({
    category: category.value as string,
    source: source.value as string,
    is_fixed: isFixed,
    tags: tags ?? [],
    bank_account_description: bank_account_description.label as string,
    ...rest,
    ...(isFixed
      ? { installments: 1, performActionsOnFutureFixedEntities }
      : { installments }),
  });
};

const editExpenseMutation = async (
  id: number,
  data: yup.Asserts<typeof schema>,
) => {
  const {
    category,
    source,
    installments,
    isFixed,
    tags,
    performActionsOnFutureFixedEntities,
    bank_account_description,
    ...rest
  } = data;
  await editExpense({
    id,
    data: {
      category: category.value as string,
      source: source.value as string,
      is_fixed: isFixed,
      tags: tags ?? [],
      bank_account_description: bank_account_description.label as string,
      ...rest,
      ...(isFixed
        ? { installments: 1, performActionsOnFutureFixedEntities }
        : { installments }),
    },
  });
};

const ExpenseForm = ({
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
  initialData?: Expense;
}) => {
  const { sources, categories, mostCommonCategory, mostCommonSource } =
    useContext(ExpensesContext);
  const { data: defaultBankAccount, accounts: bankAccounts } = useDefaultBankAccount();

  const {
    id: expenseId,
    category,
    source,
    created_at,
    is_fixed,
    bank_account_description: _bankAccountDescription,
    ...rest
  } = initialData ?? {
    category: mostCommonCategory?.name ?? "Alimentação",
    source: mostCommonSource?.name ?? "Cartão de crédito",
    is_fixed: false,
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
        hex_color: categories.hexColorMapping.get(category),
      },
      source: {
        label: source,
        value: source,
        hex_color: sources.hexColorMapping.get(source),
      },
      installments: 1,
      bank_account_description: defaultBankAccountOption,
      ...rest,
    }),
    [category, created_at, is_fixed, rest, source, categories, sources, mostCommonCategory, mostCommonSource, defaultBankAccountOption],
  );

  const queryClient = useQueryClient();
  const { invalidate: invalidateExpensesQueries } =
    useInvalidateExpenseQueries(queryClient);

  const updateCachedData = useCallback(
    (data: yup.Asserts<typeof schema> & { id: number }) => {
      const { category, source, created_at, bank_account_description, ...rest } = data;
      const expensesData = queryClient.getQueriesData({
        queryKey: [EXPENSES_QUERY_KEY],
        type: "active",
      });
      expensesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Expense>
        ).results.map((expense) =>
          expense.id === data.id
            ? {
              ...expense,
              ...rest,
              created_at: formatISO(created_at, { representation: "date" }),
              category: category.label,
              source: source.label,
              bank_account_description: bank_account_description.label,
            }
            : expense,
        );

        queryClient.setQueryData(
          queryKey,
          (oldData: ApiListResponse<Expense>) => ({
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
    setValue,
  } = useFormPlus({
    mutationFn: expenseId
      ? (data) => editExpenseMutation(expenseId, data)
      : createExpenseMutation,
    schema: schema,
    defaultValues,
    onSuccess: async () => {
      const data = getValues() as yup.Asserts<typeof schema>;
      await invalidateExpensesQueries({
        isUpdatingValue: data.value !== defaultValues.value,
        invalidateTableQuery: !expenseId,
        tags: data.tags ?? [],
      });

      enqueueSnackbar(
        `Despesa ${expenseId ? "editada" : "criada"} com sucesso`,
        {
          variant: "success",
        },
      );
      if (expenseId) {
        updateCachedData({ ...data, id: expenseId });
        onEditSuccess?.();
      } else reset({ ...data, description: "", value: "", installments: 1 });
    },
  });

  const isFixed = watch("isFixed");
  const installments = watch("installments");
  const selectedTags = watch("tags");

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
          <Stack spacing={0.5}>
            <TextField
              {...field}
              label="Descrição"
              required
              error={isFieldInvalid(field)}
              variant="standard"
            />
            {getFieldHasError(field.name) && (
              <FormFeedbackError message={getErrorMessage(field.name)} />
            )}
          </Stack>
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
        <Controller
          name="installments"
          control={control}
          defaultValue={1}
          render={({ field }) => (
            <TextField
              {...field}
              label="Parcelas"
              type="number"
              InputProps={{ inputProps: { min: 1 } }}
              error={isFieldInvalid(field)}
              helperText={
                getErrorMessage(field.name) ||
                (installments > 1 && (
                  <Stack spacing={0.1}>
                    <p>Coloque o valor completo </p>
                    <p>da compra (e não da parcela)</p>
                  </Stack>
                ))
              }
              style={{
                display: isFixed ? "none" : "",
              }}
              variant="standard"
            />
          )}
        />
        <Typography
          component="div"
          style={{
            display: isFixed ? "" : "none",
          }}
        >
          <FormLabel>Aplicar em despesas futuras?</FormLabel>
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
        entities={categories.results}
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <AutoCompleteForRelatedEntities
        entities={sources.results}
        name="source"
        label="Fonte"
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
              }              onChange={(_, value) => field.onChange(value)}
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
      <TagsAutoComplete
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
        selectedTags={selectedTags}
      />
    </Stack>
  );
};

export default ExpenseForm;

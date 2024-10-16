import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";

import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import {
  EXPENSES_QUERY_KEY,
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
} from "../../../consts";

import {
  DateInput,
  AutocompleteFromObject,
  PriceWithCurrencyInput,
} from "../../../../../../design-system";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import { createExpense, editExpense } from "../../../api/expenses";
import { useInvalidateExpenseQueries } from "../../../hooks";
import { Expense } from "../../../api/models";
import { useQueryClient } from "@tanstack/react-query";
import { ApiListResponse } from "../../../../../../types";
import { formatISO } from "date-fns";

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
});

const createExpenseMutation = async (data: yup.Asserts<typeof schema>) => {
  const {
    category,
    source,
    installments,
    isFixed,
    performActionsOnFutureFixedEntities,
    ...rest
  } = data;
  await createExpense({
    category: category.value as string,
    source: source.value as string,
    is_fixed: isFixed,
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
    performActionsOnFutureFixedEntities,
    ...rest
  } = data;
  await editExpense({
    id,
    data: {
      category: category.value as string,
      source: source.value as string,
      is_fixed: isFixed,
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
  const {
    id: expenseId,
    category,
    source,
    created_at,
    is_fixed,
    ...rest
  } = initialData ?? {
    category: "Alimentação",
    source: "Cartão de crédito",
    is_fixed: false,
  };
  const defaultValues = useMemo(
    () => ({
      description: "",
      value: "",
      created_at: created_at ? new Date(created_at + "T00:00") : new Date(),
      isFixed: is_fixed,
      category: {
        label: category,
        value:
          ExpensesCategoriesMapping[
            category as keyof typeof ExpensesCategoriesMapping
          ].value,
      },
      source: {
        label: source,
        value:
          ExpensesSourcesMapping[source as keyof typeof ExpensesSourcesMapping]
            .value,
      },
      installments: 1,
      ...rest,
    }),
    [category, created_at, is_fixed, rest, source],
  );

  const queryClient = useQueryClient();
  const { invalidate: invalidateExpensesQueries } =
    useInvalidateExpenseQueries(queryClient);

  const updateCachedData = (
    data: yup.Asserts<typeof schema> & { id: number },
  ) => {
    const { category, source, created_at, ...rest } = data;
    const assetsData = queryClient.getQueriesData({
      queryKey: [EXPENSES_QUERY_KEY],
      type: "active",
    });
    assetsData.forEach(([queryKey, cachedData]) => {
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
  };

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
      } else reset({ ...data, description: "", value: "" });
    },
  });
  const isFixed = watch("isFixed");
  const installments = watch("installments");

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
      <AutocompleteFromObject
        obj={ExpensesCategoriesMapping}
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
      <AutocompleteFromObject
        obj={ExpensesSourcesMapping}
        name="source"
        label="Fonte"
        control={control}
        isFieldInvalid={isFieldInvalid}
        getFieldHasError={getFieldHasError}
        getErrorMessage={getErrorMessage}
      />
    </Stack>
  );
};

export default ExpenseForm;

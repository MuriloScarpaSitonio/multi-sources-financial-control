import { type Dispatch, type SetStateAction, useEffect } from "react";

import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import {
  EXPENSES_QUERY_KEY,
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
} from "../../../consts";
import { useInvalidateExpensesIndicatorsQueries } from "../../../Indicators/hooks/expenses";
import {
  useInvalidateExpensesAvgComparasionReportQueries,
  useInvalidateExpensesPercentagenReportQueries,
  useInvalidateExpensesHistoricReportQueries,
} from "../../../Reports/hooks";
import {
  DateInput,
  AutocompleteFromObject,
  PriceWithCurrencyInput,
} from "../../../../../../design-system";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import { createExpense } from "../../../api/expenses";

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
  const { category, source, installments, isFixed, ...rest } = data;
  await createExpense({
    category: category.value as string,
    source: source.value as string,
    is_fixed: isFixed,
    ...rest,
    ...(isFixed ? { installments: 1 } : { installments }),
  });
};

const ExpenseForm = ({
  id,
  setIsSubmitting,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
}) => {
  const defaultValues = {
    description: "",
    value: "",
    created_at: new Date(),
    isFixed: false,
    category: {
      label: "",
      value: "",
    },
    source: {
      label: "",
      value: "",
    },
    installments: 1,
  };

  const queryClient = useQueryClient();
  const { invalidate: invalidateIndicatorsQueries } =
    useInvalidateExpensesIndicatorsQueries();
  const { invalidate: invalidateAvgComparasionReportQueries } =
    useInvalidateExpensesAvgComparasionReportQueries();
  const { invalidate: invalidatePercentageReportQueries } =
    useInvalidateExpensesPercentagenReportQueries();
  const { invalidate: invalidateHistoricReportQueries } =
    useInvalidateExpensesHistoricReportQueries();

  const {
    control,
    handleSubmit,
    reset,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
    watch,
  } = useFormPlus({
    mutationFn: createExpenseMutation,
    schema: schema,
    defaultValues,
    onSuccess: async () => {
      await invalidateIndicatorsQueries();
      await invalidateAvgComparasionReportQueries();
      await invalidatePercentageReportQueries();
      await invalidatePercentageReportQueries();
      await invalidateHistoricReportQueries();

      await queryClient.invalidateQueries({
        queryKey: [EXPENSES_QUERY_KEY],
      });
      enqueueSnackbar("Despesa criado com sucesso", {
        variant: "success",
      });
      reset();
    },
  });
  const isFixed = watch("isFixed");
  const installments = watch("installments");

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);

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

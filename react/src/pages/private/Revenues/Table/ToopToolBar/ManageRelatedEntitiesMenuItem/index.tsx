import { useCallback, useContext } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import RuleIcon from "@mui/icons-material/Rule";

import { enqueueSnackbar } from "notistack";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import { Colors, Text, getColor } from "../../../../../../design-system";
import {
  ExpensesContext,
  type ExpenseRelatedEntity,
} from "../../../../Expenses/context";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import { deleteCategory, updateCategory } from "../../../api";
import { REVENUES_QUERY_KEY } from "../../../consts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvalidateCategoriesQueries } from "../../../hooks/useGetCategories";
import { ApiListResponse } from "../../../../../../types";
import { Revenue } from "../../../models";
import { AutoCompleteForRelatedEntitiesColors } from "../../../../Expenses/components";
// import { PERCENTAGE_REPORT_QUERY_KEY } from "../../../Reports/hooks";

const schema = yup.object().shape({
  name: yup.string().required("O nome é obrigatória"),
  hex_color: yup
    .object()
    .shape({
      label: yup.string().required("A cor é obrigatória"),
      value: yup.string().required("A cor é obrigatória"),
    })
    .required("A cor é obrigatória"),
});

const RelatedEntityForm = ({ entity }: { entity: ExpenseRelatedEntity }) => {
  const queryClient = useQueryClient();

  const { invalidate: invalidateCategories } =
    useInvalidateCategoriesQueries(queryClient);

  const updateCachedData = useCallback(
    ({ name, prevName }: { name: string; prevName: string }) => {
      // const reportData = queryClient.getQueriesData({
      //   queryKey: [PERCENTAGE_REPORT_QUERY_KEY, { group_by: kind }],
      //   type: "active",
      // });
      // reportData.forEach(([queryKey, cachedData]) => {
      //   const newCachedData = (
      //     cachedData as ({ [kind: string]: string } & { total: number })[]
      //   ).map((data) =>
      //     data.category === prevName ? { ...data, category: name } : data,
      //   );

      //   queryClient.setQueryData(queryKey, newCachedData);
      // });
      const expensesData = queryClient.getQueriesData({
        queryKey: [REVENUES_QUERY_KEY],
        type: "active",
      });
      expensesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Revenue>
        ).results.map((revenue) =>
          revenue.category === prevName
            ? { ...revenue, category: name }
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
    mutate: updateEntity,
    isPending: isUpdating,
    isDirty,
    reset,
    getValues,
    getFieldHasError,
    getErrorMessage,
    isFieldInvalid,
  } = useFormPlus({
    mutationFn: updateCategory,
    schema: schema,
    defaultValues: {
      ...entity,
      hex_color: {
        label: entity.hex_color,
        value: entity.hex_color,
      },
    },
    onSuccess: async () => {
      const data = getValues() as yup.Asserts<typeof schema>;
      invalidateCategories();
      reset(data);
      updateCachedData({ name: data.name, prevName: entity.name });
      enqueueSnackbar("Categoria editada com sucesso!", {
        variant: "success",
      });
    },
  });

  const { mutate: deleteEntity, isPending: isDeleting } = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      invalidateCategories();
      enqueueSnackbar("Categoria deletada com sucesso!", {
        variant: "success",
      });
    },
  });

  return (
    <Stack gap={1} component="form" noValidate>
      <Stack direction="row" gap={1}>
        <Controller
          name="name"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nome"
              required
              error={getFieldHasError(field.name)}
              helperText={getErrorMessage(field.name)}
              variant="standard"
              sx={{ width: "75%" }}
            />
          )}
        />
        <AutoCompleteForRelatedEntitiesColors
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
        />
      </Stack>
      <Stack direction="row" gap={0.1} justifyContent="flex-end">
        <Button variant="danger-text" onClick={() => deleteEntity(entity.id)}>
          {isDeleting ? (
            <CircularProgress color="inherit" size={24} />
          ) : (
            "Deletar"
          )}
        </Button>
        <Button
          variant={isDirty ? "brand-text" : "neutral-text"}
          type="submit"
          disabled={!isDirty}
          onClick={handleSubmit(
            ({
              name,
              hex_color: { value: hex_color },
            }: yup.Asserts<typeof schema>) => {
              updateEntity({
                id: entity.id,
                data: {
                  name,
                  hex_color,
                },
              });
            },
          )}
        >
          {isUpdating ? (
            <CircularProgress color="inherit" size={24} />
          ) : (
            "Salvar"
          )}
        </Button>
      </Stack>
    </Stack>
  );
};

export const ManageRelatedEntitiesDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { revenuesCategories } = useContext(ExpensesContext);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      PaperProps={{
        sx: {
          backgroundColor: getColor(Colors.neutral600),
          boxShadow: "none",
          backgroundImage: "none",
        },
      }}
    >
      <Stack spacing={5} sx={{ p: 3 }}>
        <Text>Gerenciar categorias</Text>
        <Stack gap={1}>
          {revenuesCategories.results.map((entity) => (
            <RelatedEntityForm
              entity={entity}
              key={`related-entity-form-${entity.id}`}
            />
          ))}
        </Stack>
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <Button onClick={onClose} variant="brand">
            Fechar
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export const ManageRelatedEntitiesMenuItem = ({
  onClick,
}: {
  onClick: () => void;
}) => (
  <MenuItem onClick={onClick}>
    <ListItemIcon>
      <RuleIcon />
    </ListItemIcon>
    <ListItemText>Gerenciar categorias</ListItemText>
  </MenuItem>
);

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useContext, useEffect, useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
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
import { addCategory, deleteCategory, updateCategory } from "../../../api";
import { REVENUES_QUERY_KEY } from "../../../consts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvalidateCategoriesQueries } from "../../../hooks/useGetCategories";
import { ApiListResponse } from "../../../../../../types";
import { Revenue } from "../../../models";
import { AutoCompleteForRelatedEntitiesColors } from "../../../../Expenses/components";
import { PERCENTAGE_REPORT_QUERY_KEY } from "../../../Reports/hooks";

const schema = yup.object().shape({
  name: yup.string().required("O nome é obrigatório"),
  hex_color: yup
    .object()
    .shape({
      label: yup.string().required("A cor é obrigatória"),
      value: yup.string().required("A cor é obrigatória"),
    })
    .required("A cor é obrigatória"),
});

const FORM_ID = "new-revenue-category-form-id";

const NewCategoryForm = ({
  id,
  setIsSubmitting,
  excludeColors,
}: {
  id: string;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  excludeColors: string[];
}) => {
  const queryClient = useQueryClient();

  const { invalidate: invalidateCategories } =
    useInvalidateCategoriesQueries(queryClient);

  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    reset,
    getFieldHasError,
    getErrorMessage,
    isFieldInvalid,
  } = useFormPlus({
    mutationFn: addCategory,
    schema: schema,
    defaultValues: { name: "", hex_color: { label: "", value: "" } },
    onSuccess: async () => {
      invalidateCategories();
      reset();
      enqueueSnackbar("Categoria adicionada com sucesso!", {
        variant: "success",
      });
    },
  });

  useEffect(() => setIsSubmitting(isPending), [isPending, setIsSubmitting]);
  return (
    <Stack
      gap={1}
      component="form"
      noValidate
      id={id}
      onSubmit={handleSubmit((data: yup.Asserts<typeof schema>) =>
        mutate({ ...data, hex_color: data.hex_color.value }),
      )}
      sx={{ marginBottom: 2 }}
    >
      <Stack direction="row" spacing={1}>
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
              sx={{ width: "80%" }}
            />
          )}
        />
        <AutoCompleteForRelatedEntitiesColors
          control={control}
          isFieldInvalid={isFieldInvalid}
          getFieldHasError={getFieldHasError}
          getErrorMessage={getErrorMessage}
          sx={{ width: "15%" }}
          excludeValues={excludeColors}
        />
      </Stack>
    </Stack>
  );
};

const NewCategoryDialog = ({
  open,
  onClose,
  currentColors,
}: {
  open: boolean;
  onClose: () => void;
  currentColors: string[];
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: {
          backgroundColor: getColor(Colors.neutral600),
          boxShadow: "none",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle>Adicionar nova categoria</DialogTitle>
      <DialogContent>
        <NewCategoryForm
          id={FORM_ID}
          setIsSubmitting={setIsSubmitting}
          excludeColors={currentColors}
        />
        <DialogActions>
          <Button onClick={onClose} variant="brand-text">
            Fechar
          </Button>
          <Button type="submit" variant="brand" form={FORM_ID}>
            {isSubmitting ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

const RevenueCategoryForm = ({
  category,
}: {
  category: ExpenseRelatedEntity;
}) => {
  const queryClient = useQueryClient();

  const { invalidate: invalidateCategories } =
    useInvalidateCategoriesQueries(queryClient);

  const updateCachedData = useCallback(
    ({ name, prevName }: { name: string; prevName: string }) => {
      const reportData = queryClient.getQueriesData({
        queryKey: [PERCENTAGE_REPORT_QUERY_KEY],
        type: "active",
      });
      reportData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as { category: string; total: number }[]
        ).map((data) =>
          data.category === prevName ? { ...data, category: name } : data,
        );

        queryClient.setQueryData(queryKey, newCachedData);
      });
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
      ...category,
      hex_color: {
        label: category.hex_color,
        value: category.hex_color,
      },
    },
    onSuccess: async () => {
      const data = getValues() as yup.Asserts<typeof schema>;
      invalidateCategories();
      reset(data);
      updateCachedData({ name: data.name, prevName: category.name });
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
        <Button variant="danger-text" onClick={() => deleteEntity(category.id)}>
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
                id: category.id,
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
  const [openDialog, setOpenDialog] = useState(false);

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
      <Stack spacing={4} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Text>Gerenciar categorias</Text>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              startIcon={<AddIcon />}
              size="small"
              variant="brand"
              onClick={() => setOpenDialog(true)}
            >
              Categoria
            </Button>
          </Stack>
        </Stack>
        <Stack spacing={1}>
          {revenuesCategories.results.map((category) => (
            <RevenueCategoryForm
              category={category}
              key={`related-entity-form-${category.id}`}
            />
          ))}
        </Stack>
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <Button onClick={onClose} variant="brand">
            Fechar
          </Button>
        </Stack>
      </Stack>
      <NewCategoryDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        currentColors={Array.from(revenuesCategories.hexColorMapping.values())}
      />
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

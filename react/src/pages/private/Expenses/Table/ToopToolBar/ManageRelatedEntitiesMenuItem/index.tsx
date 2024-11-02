import { useCallback, useContext, useState } from "react";

import Tab from "@mui/material/Tab";

import Autocomplete from "@mui/material/Autocomplete";
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

import {
  Colors,
  Text,
  getColor,
  ReportTabs,
  FormFeedbackError,
} from "../../../../../../design-system";
import {
  ExpensesContext,
  type RelatedEntityResultsAndHexColorMapping,
  type ExpenseRelatedEntity,
} from "../../../context";
import useFormPlus from "../../../../../../hooks/useFormPlus";
import {
  deleteCategory,
  deleteSource,
  updateCategory,
  updateSource,
} from "../../../api/expenses";
import { ColorsMapping, EXPENSES_QUERY_KEY } from "../../../consts";
import { StatusDot } from "../../../../../../design-system/icons";
import { InputAdornment } from "@mui/material";
import { ReactHookFormsInputCustomProps } from "../../../../../../design-system/components/forms/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useInvalidateCategoriesQueries,
  useInvalidateSourcesQueries,
} from "../../../hooks";
import { ApiListResponse } from "../../../../../../types";
import { Expense } from "../../../api/models";
import { PERCENTAGE_REPORT_QUERY_KEY } from "../../../Reports/hooks";

type RelatedEntityKind = "category" | "source";

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

const AutocompleteFromObject = ({
  control,
  isFieldInvalid,
  getFieldHasError,
  getErrorMessage,
}: ReactHookFormsInputCustomProps) => (
  <Stack gap={1} sx={{ width: "25%" }}>
    <Controller
      name="hex_color"
      control={control}
      rules={{ required: true }}
      render={({ field }) => (
        <Autocomplete
          {...field}
          onChange={(_, source) => field.onChange(source)}
          disableClearable
          options={Object.entries(ColorsMapping).map(([label, { value }]) => ({
            label,
            value,
          }))}
          getOptionLabel={() => ""}
          filterOptions={(options, state) => {
            return state.inputValue
              ? options.filter(
                  (option) =>
                    option.label
                      .toLowerCase()
                      .indexOf(state.inputValue.toLowerCase()) !== -1,
                )
              : options;
          }}
          isOptionEqualToValue={({ value: optionValue }, { value }) =>
            optionValue === value
          }
          renderOption={(props, option) => (
            <MenuItem
              {...props}
              key={`${option.value}-${option.label}`}
              value={option.value}
            >
              <StatusDot variant="custom" color={option.value} />
            </MenuItem>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              value=""
              error={isFieldInvalid(field)}
              required
              label="Cor"
              variant="standard"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <StatusDot
                      variant="custom"
                      color={field.value.value as string}
                    />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
      )}
    />
    {getFieldHasError("hex_color") && (
      <FormFeedbackError message={getErrorMessage("hex_color")} />
    )}
  </Stack>
);

const RelatedEntityForm = ({
  entity,
  kind,
}: {
  entity: ExpenseRelatedEntity;
  kind: RelatedEntityKind;
}) => {
  const queryClient = useQueryClient();

  const { invalidate: invalidateCategories } =
    useInvalidateCategoriesQueries(queryClient);
  const { invalidate: invalidateSources } =
    useInvalidateSourcesQueries(queryClient);

  const onSuccess = useCallback(() => {
    if (kind === "category") invalidateCategories();
    else invalidateSources();
  }, [kind, invalidateCategories, invalidateSources]);

  const entityLabel = kind === "category" ? "Categoria" : "Fonte";

  const updateCachedData = useCallback(
    ({ name, prevName }: { name: string; prevName: string }) => {
      const reportData = queryClient.getQueriesData({
        queryKey: [PERCENTAGE_REPORT_QUERY_KEY, { group_by: kind }],
        type: "active",
      });
      reportData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ({ [kind: string]: string } & { total: number })[]
        ).map((data) =>
          data[kind] === prevName ? { ...data, [kind]: name } : data,
        );

        queryClient.setQueryData(queryKey, newCachedData);
      });
      const expensesData = queryClient.getQueriesData({
        queryKey: [EXPENSES_QUERY_KEY],
        type: "active",
      });
      expensesData.forEach(([queryKey, cachedData]) => {
        const newCachedData = (
          cachedData as ApiListResponse<Expense>
        ).results.map((expense) =>
          expense[kind] === prevName ? { ...expense, [kind]: name } : expense,
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
    [queryClient, kind],
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
    mutationFn: kind === "category" ? updateCategory : updateSource,
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
      onSuccess();
      reset(data);
      updateCachedData({ name: data.name, prevName: entity.name });
      enqueueSnackbar(`${entityLabel} editada com sucesso!`, {
        variant: "success",
      });
    },
  });

  const { mutate: deleteEntity, isPending: isDeleting } = useMutation({
    mutationFn: kind === "category" ? deleteCategory : deleteSource,
    onSuccess: () => {
      onSuccess();
      enqueueSnackbar(`${entityLabel} deletada com sucesso!`, {
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
        <AutocompleteFromObject
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

const TabsContent = ({
  content,
  kind,
}: {
  content: RelatedEntityResultsAndHexColorMapping;
  kind: RelatedEntityKind;
}) => {
  return (
    <Stack gap={1}>
      {content.results.map((entity) => (
        <RelatedEntityForm
          entity={entity}
          kind={kind}
          key={`related-entity-${kind}-form-${entity.id}`}
        />
      ))}
    </Stack>
  );
};
const Tabs = () => {
  const [kind, setKind] = useState<RelatedEntityKind>("category");

  const [tabValue, setTabValue] = useState(0);
  const { sources, categories } = useContext(ExpensesContext);

  return (
    <Stack gap={2}>
      <ReportTabs
        value={tabValue}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setTabValue(newValue);
              setKind("category");
              break;
            case 1:
              setTabValue(newValue);
              setKind("source");
              break;
            default:
              break;
          }
        }}
      >
        <Tab label="Categorias" />
        <Tab label="Fontes" />
      </ReportTabs>
      <TabsContent
        content={kind === "category" ? categories : sources}
        kind={kind}
      />
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
        <Text>Gerenciar categorias e fontes</Text>
        <Tabs />
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
    <ListItemText>Gerenciar categorias e fontes</ListItemText>
  </MenuItem>
);

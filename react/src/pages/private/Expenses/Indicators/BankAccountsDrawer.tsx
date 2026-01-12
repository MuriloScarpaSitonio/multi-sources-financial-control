import { useEffect, useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";

import { enqueueSnackbar } from "notistack";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import {
  Colors,
  FontSizes,
  getColor,
  FormFeedbackError,
  NumberFormat,
  Text,
} from "../../../../design-system";
import { useHideValues } from "../../../../hooks/useHideValues";
import type { BankAccount } from "../api/models";
import {
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useUpdateBankAccount,
} from "../hooks";

const schema = yup.object().shape({
  description: yup.string().required("A descrição é obrigatória"),
  amount: yup
    .number()
    .required("O saldo é obrigatório")
    .typeError("O saldo é obrigatório"),
  is_default: yup.boolean().default(false),
  credit_card_bill_day: yup
    .number()
    .nullable()
    .transform((value, originalValue) =>
      originalValue === "" ? null : value
    )
    .min(1, "O dia deve ser entre 1 e 31")
    .max(31, "O dia deve ser entre 1 e 31"),
});

type BankAccountFormData = yup.InferType<typeof schema>;

const BankAccountForm = ({
  initialData,
  onSave,
  onCancel,
  isPending,
}: {
  initialData?: BankAccount;
  onSave: (data: BankAccountFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<BankAccountFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      description: initialData?.description ?? "",
      amount: initialData?.amount ?? 0,
      is_default: initialData?.is_default ?? false,
      credit_card_bill_day: initialData?.credit_card_bill_day ?? null,
    },
    mode: "onSubmit",
  });

  const isDefault = watch("is_default");

  useEffect(() => {
    reset({
      description: initialData?.description ?? "",
      amount: initialData?.amount ?? 0,
      is_default: initialData?.is_default ?? false,
      credit_card_bill_day: initialData?.credit_card_bill_day ?? null,
    });
  }, [initialData, reset]);

  const isFieldInvalid = (fieldName: keyof BankAccountFormData): boolean =>
    !!errors[fieldName];

  const getErrorMessage = (fieldName: keyof BankAccountFormData): string =>
    errors[fieldName]?.message ?? "";

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit(onSave)}
      spacing={2}
      sx={{
        p: 2,
        backgroundColor: getColor(Colors.neutral700),
        borderRadius: "8px",
      }}
    >
      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <Stack spacing={0.5}>
            <TextField
              {...field}
              label="Descrição"
              required
              error={isFieldInvalid("description")}
              size="small"
              fullWidth
              variant="standard"
            />
            {isFieldInvalid("description") && (
              <FormFeedbackError message={getErrorMessage("description")} />
            )}
          </Stack>
        )}
      />
      <Controller
        name="amount"
        control={control}
        render={({ field }) => (
          <Stack spacing={0.5}>
            <TextField
              {...field}
              label="Saldo"
              error={isFieldInvalid("amount")}
              InputProps={{
                inputComponent: NumberFormat,
                inputProps: { prefix: field.value < 0 ? "R$ -" : "R$ ", allowNegative: true },
              }}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
              variant="standard"
            />
            {isFieldInvalid("amount") && (
              <FormFeedbackError message={getErrorMessage("amount")} />
            )}
          </Stack>
        )}
      />
      <Controller
        name="credit_card_bill_day"
        control={control}
        render={({ field }) => (
          <Stack spacing={0.5}>
            <TextField
              {...field}
              value={field.value ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val === "" ? null : parseInt(val));
              }}
              label="Dia de vencimento do cartão (opcional)"
              error={isFieldInvalid("credit_card_bill_day")}
              type="number"
              size="small"
              fullWidth
              inputProps={{ min: 1, max: 31 }}
              helperText={
                !isFieldInvalid("credit_card_bill_day")
                  ? "Se esta conta tem cartão de crédito associado"
                  : undefined
              }
              variant="standard"
            />
            {isFieldInvalid("credit_card_bill_day") && (
              <FormFeedbackError message={getErrorMessage("credit_card_bill_day")} />
            )}
          </Stack>
        )}
      />
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton
          size="small"
          onClick={() => setValue("is_default", !isDefault)}
          sx={{ color: isDefault ? getColor(Colors.brand) : getColor(Colors.neutral400) }}
        >
          {isDefault ? <StarIcon /> : <StarOutlineIcon />}
        </IconButton>
        <Text size={FontSizes.SEMI_SMALL} color={Colors.neutral300}>
          {isDefault ? "Conta padrão" : "Definir como padrão"}
        </Text>
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="brand-text" onClick={onCancel} size="small">
          Cancelar
        </Button>
        <Button type="submit" variant="brand" size="small" disabled={isPending}>
          {isPending ? (
            <CircularProgress color="inherit" size={20} />
          ) : initialData ? (
            "Salvar"
          ) : (
            "Criar"
          )}
        </Button>
      </Stack>
    </Stack>
  );
};

const BankAccountItem = ({
  account,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting,
}: {
  account: BankAccount;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isDeleting: boolean;
}) => {
  const { hideValues } = useHideValues();

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{
        p: 2,
        backgroundColor: getColor(Colors.neutral700),
        borderRadius: "8px",
        "&:hover": {
          backgroundColor: getColor(Colors.neutral600),
        },
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Text size={FontSizes.SMALL}>{account.description}</Text>
          {account.is_default && (
            <Chip
              label="Padrão"
              size="small"
              sx={{
                backgroundColor: getColor(Colors.brand),
                color: getColor(Colors.neutral0),
                height: "20px",
                fontSize: "10px",
              }}
            />
          )}
          {account.credit_card_bill_day && (
            <Chip
              label={`Venc. dia ${account.credit_card_bill_day}`}
              size="small"
              sx={{
                backgroundColor: getColor(Colors.neutral400),
                color: getColor(Colors.neutral200),
                height: "20px",
                fontSize: "10px",
              }}
            />
          )}
        </Stack>
        {hideValues ? (
          <Skeleton
            sx={{ bgcolor: getColor(Colors.neutral300), width: "80px" }}
            animation={false}
          />
        ) : (
          <Text
            size={FontSizes.SEMI_SMALL}
            color={account.amount >= 0 ? Colors.brand : Colors.danger200}
          >
            R${" "}
            {account.amount.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        )}
      </Stack>
      <Stack direction="row" spacing={0.5}>
        {!account.is_default && (
          <IconButton
            size="small"
            onClick={onSetDefault}
            sx={{ color: getColor(Colors.neutral400) }}
            title="Definir como padrão"
          >
            <StarOutlineIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={onEdit}
          sx={{ color: getColor(Colors.neutral400) }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        {!account.is_default && <IconButton
          size="small"
          onClick={onDelete}
          disabled={isDeleting}
          sx={{
            color: getColor(Colors.neutral400),
          }}
          title="Excluir"
        >
          {isDeleting ? (
            <CircularProgress size={16} />
          ) : (
            <DeleteIcon fontSize="small" />
          )}
        </IconButton>}
      </Stack>
    </Stack>
  );
};

const BankAccountsDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { data: { results: accounts } = { results: [] }, isPending: isAccountsLoading } = useBankAccounts();
  const createMutation = useCreateBankAccount();
  const updateMutation = useUpdateBankAccount();
  const deleteMutation = useDeleteBankAccount();

  const [isCreating, setIsCreating] = useState(false);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [deletingDescription, setDeletingDescription] = useState<string | null>(null);

  const handleCreate = (data: BankAccountFormData) => {
    createMutation.mutate(
      {
        description: data.description,
        amount: data.amount,
        is_default: data.is_default,
        credit_card_bill_day: data.credit_card_bill_day,
      },
      {
        onSuccess: () => {
          enqueueSnackbar("Conta bancária criada com sucesso!", {
            variant: "success",
          });
          setIsCreating(false);
        },
        onError: () => {
          enqueueSnackbar("Erro ao criar conta bancária", { variant: "error" });
        },
      }
    );
  };

  const handleUpdate = (oldDescription: string, data: BankAccountFormData) => {
    updateMutation.mutate(
      {
        description: oldDescription,
        data: {
          description: data.description,
          amount: data.amount,
          is_default: data.is_default,
          credit_card_bill_day: data.credit_card_bill_day,
        },
      },
      {
        onSuccess: () => {
          enqueueSnackbar("Conta bancária atualizada com sucesso!", {
            variant: "success",
          });
          setEditingDescription(null);
        },
        onError: () => {
          enqueueSnackbar("Erro ao atualizar conta bancária", {
            variant: "error",
          });
        },
      }
    );
  };

  const handleDelete = (description: string) => {
    setDeletingDescription(description);
    deleteMutation.mutate(description, {
      onSuccess: () => {
        enqueueSnackbar("Conta bancária excluída com sucesso!", {
          variant: "success",
        });
        setDeletingDescription(null);
      },
      onError: () => {
        enqueueSnackbar("Erro ao excluir conta bancária", { variant: "error" });
        setDeletingDescription(null);
      },
    });
  };

  const handleSetDefault = (account: BankAccount) => {
    updateMutation.mutate(
      {
        description: account.description,
        data: {
          description: account.description,
          amount: account.amount,
          is_default: true,
          credit_card_bill_day: account.credit_card_bill_day,
        },
      },
      {
        onSuccess: () => {
          enqueueSnackbar("Conta padrão atualizada!", { variant: "success" });
        },
        onError: () => {
          enqueueSnackbar("Erro ao definir conta padrão", { variant: "error" });
        },
      }
    );
  };

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
          width: "400px",
        },
      }}
    >
      <Stack spacing={3} sx={{ p: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text size={FontSizes.MEDIUM}>Contas Bancárias</Text>
          <Button
            variant="brand"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
          >
            Nova conta
          </Button>
        </Stack>

        <Divider sx={{ borderColor: getColor(Colors.neutral400) }} />

        {isCreating && (
          <BankAccountForm
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
            isPending={createMutation.isPending}
          />
        )}

        {isAccountsLoading ? (
          <Stack spacing={2}>
            <Skeleton height={80} sx={{ borderRadius: "8px" }} />
            <Skeleton height={80} sx={{ borderRadius: "8px" }} />
          </Stack>
        ) : !Array.isArray(accounts) || accounts.length === 0 ? (
          <Text size={FontSizes.SMALL} color={Colors.neutral400}>
            Nenhuma conta bancária cadastrada
          </Text>
        ) : (
          <Stack spacing={2}>
            {(Array.isArray(accounts) ? accounts : []).map((account) =>
              editingDescription === account.description ? (
                <BankAccountForm
                  key={account.description}
                  initialData={account}
                  onSave={(data) => handleUpdate(account.description, data)}
                  onCancel={() => setEditingDescription(null)}
                  isPending={updateMutation.isPending}
                />
              ) : (
                <BankAccountItem
                  key={account.description}
                  account={account}
                  onEdit={() => setEditingDescription(account.description)}
                  onDelete={() => handleDelete(account.description)}
                  onSetDefault={() => handleSetDefault(account)}
                  isDeleting={deletingDescription === account.description}
                />
              )
            )}
          </Stack>
        )}

        <Stack direction="row" justifyContent="flex-end">
          <Button variant="brand-text" onClick={onClose}>
            Fechar
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export default BankAccountsDrawer;

import type { Dispatch, SetStateAction } from "react";

import { useState } from "react";

import Button from "@mui/material/Button";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import EditIcon from "@mui/icons-material/Edit";

import {
  Colors,
  FontSizes,
  getColor,
  NumberFormat,
  Text,
} from "../../../../design-system";
import { IndicatorBox } from "./components";
import { useMutation } from "@tanstack/react-query";
import { CircularProgress } from "@mui/material";
import { update as updateBankAccount } from "../api/bank_account";
import { enqueueSnackbar } from "notistack";

const BankAcountDescriptionInput = ({
  description,
  setNewDescription,
}: {
  description: string;
  setNewDescription: Dispatch<SetStateAction<string>>;
}) => (
  <OutlinedInput
    size="small"
    placeholder="Descrição"
    defaultValue={description}
    onChange={(e) => setNewDescription(e.target.value)}
    endAdornment={<EditIcon sx={{ color: getColor(Colors.neutral400) }} />}
    sx={{
      "&.MuiOutlinedInput-root": {
        border: "none",
        borderRadius: "5px",
        color: getColor(Colors.neutral300),
        "&:hover": {
          backgroundColor: getColor(Colors.neutral600),
        },
      },
      "&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
        border: "none",
      },
      "&.MuiOutlinedInput-root .MuiOutlinedInput-input::placeholder": {
        color: getColor(Colors.neutral0),
      },
    }}
  />
);

const BankAccountDescriptionText = ({
  description,
}: {
  description: string;
}) => (
  <Text size={FontSizes.SEMI_SMALL} color={Colors.neutral300}>
    {description}
  </Text>
);

const BankAccountAmountInput = ({
  newAmount,
  setNewAmount,
}: {
  newAmount: number;
  setNewAmount: Dispatch<SetStateAction<number>>;
}) => (
  <TextField
    size="small"
    placeholder="Saldo em conta"
    value={newAmount}
    onChange={(e) => setNewAmount(e.target.value as unknown as number)}
    InputProps={{
      inputComponent: NumberFormat,
      inputProps: { prefix: "R$ " },
      endAdornment: <EditIcon sx={{ color: getColor(Colors.neutral400) }} />,
    }}
    variant="outlined"
    sx={{
      borderRadius: "5px",
      "&:hover": {
        backgroundColor: getColor(Colors.neutral600),
      },
      ".MuiOutlinedInput-notchedOutline": {
        border: "none",
      },
    }}
  />
);

const BankAccountAmountText = ({ amount }: { amount: number }) => (
  <Text size={FontSizes.SMALL}>
    R${" "}
    {amount.toLocaleString("pt-br", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}
  </Text>
);

const BankAccountIndicator = ({
  amount,
  description,
}: {
  amount: number;
  description: string;
}) => {
  const [isHoveringDescription, setIsHoveringDescription] = useState(false);
  const [isHoveringAmount, setIsHoveringAmount] = useState(false);
  const [newAmount, setNewAmount] = useState(amount);
  const [newDescription, setNewDescription] = useState(description);

  const { mutate, isPending } = useMutation({
    mutationFn: updateBankAccount,
    onSuccess: () => {
      enqueueSnackbar("Conta bancária atualizada com sucesso!", {
        variant: "success",
      });
    },
    onError: () => {
      enqueueSnackbar(
        "Não foi possível atualizar a conta bancária no momento. Por favor, tente novamente mais tarde",
        { variant: "error" },
      );
    },
  });

  return (
    <IndicatorBox variant={amount > 0 ? "success" : "danger"} width="50%">
      <Stack gap={0.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text size={FontSizes.SMALL}>Saldo em conta:</Text>
          {amount !== newAmount || description !== newDescription ? (
            <Button
              variant="brand-text"
              type="submit"
              size="small"
              onClick={() =>
                mutate({
                  description: newDescription,
                  amount: newAmount,
                })
              }
            >
              {isPending ? (
                <CircularProgress color="inherit" size={24} />
              ) : (
                "Salvar"
              )}
            </Button>
          ) : null}
        </Stack>
        <div
          onMouseOver={() => setIsHoveringDescription(true)}
          onMouseLeave={() => setIsHoveringDescription(false)}
        >
          {isHoveringDescription ? (
            <BankAcountDescriptionInput
              description={newDescription}
              setNewDescription={setNewDescription}
            />
          ) : (
            <BankAccountDescriptionText description={newDescription} />
          )}
        </div>
        <div
          onMouseOver={() => setIsHoveringAmount(true)}
          onMouseLeave={() => setIsHoveringAmount(false)}
        >
          {isHoveringAmount ? (
            <BankAccountAmountInput
              newAmount={newAmount}
              setNewAmount={setNewAmount}
            />
          ) : (
            <BankAccountAmountText amount={newAmount} />
          )}
        </div>
      </Stack>
    </IndicatorBox>
  );
};

export default BankAccountIndicator;

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";

import { deleteTransaction } from "../api";
import { Transaction } from "../types";
import { AssetCurrencyMap } from "../../Assets/consts";

const DeleteTransactionDialog = ({
  transaction,
  open,
  onClose,
  onSuccess,
}: {
  transaction: Transaction;
  open: boolean;
  onClose: () => void;
  onSuccess: (id: number) => Promise<void>;
}) => {
  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteTransaction(transaction.id),
    onSuccess: async () => {
      await onSuccess(transaction.id);
      onClose();
      enqueueSnackbar("Transação deletada com sucesso", { variant: "success" });
    },
  });

  if (!transaction) return;
  const transactionText = transaction.quantity
    ? `${transaction.quantity.toLocaleString(
        "pt-br",
      )} ativos de ${transaction.asset.code} por ${AssetCurrencyMap[transaction.asset.currency].symbol} ${transaction.price.toLocaleString(
        "pt-br",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        },
      )}`
    : `${AssetCurrencyMap[transaction.asset.currency].symbol} ${transaction.price.toLocaleString(
        "pt-br",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        },
      )} de ${transaction?.asset.code}`;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Tem certeza que deseja deletar essa transação?</DialogTitle>
      <DialogContent>
        <DialogContentText>{transactionText}</DialogContentText>
        <DialogActions>
          <Button variant="brand-text" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger-text" onClick={() => mutate()}>
            {isPending ? <CircularProgress size={24} /> : "Deletar"}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTransactionDialog;

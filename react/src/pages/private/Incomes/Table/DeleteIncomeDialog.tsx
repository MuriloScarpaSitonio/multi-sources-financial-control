import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";

import { deleteIncome } from "../api";
import { Income } from "../types";
import { AssetCurrencyMap } from "../../Assets/consts";
import { EventTypeLabels } from "../consts";

const DeleteIncomeDialog = ({
  income,
  open,
  onClose,
  onSuccess,
}: {
  income: Income;
  open: boolean;
  onClose: () => void;
  onSuccess: ({
    incomeId,
    isCredited,
  }: {
    incomeId: number;
    isCredited: boolean;
  }) => Promise<void>;
}) => {
  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteIncome(income.id),
    onSuccess: async () => {
      await onSuccess({
        incomeId: income.id,
        isCredited: income.event_type === EventTypeLabels.CREDITED,
      });
      onClose();
      enqueueSnackbar("Rendimento deletado com sucesso", {
        variant: "success",
      });
    },
  });

  if (!income) return;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Tem certeza que deseja deletar esse rendimento?</DialogTitle>
      <DialogContent>
        <DialogContentText>{`${AssetCurrencyMap[income.asset.currency].symbol} 
            ${income.amount.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })} de ${income?.asset.code}`}</DialogContentText>
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

export default DeleteIncomeDialog;

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";

import { deleteExpense } from "../api/expenses";
import { Expense } from "../api/models";

const DeleteExpenseDialog = ({
  expense,
  open,
  onClose,
  onSuccess,
}: {
  expense: Expense & { type: string };
  open: boolean;
  onClose: () => void;
  onSuccess: (id: number) => Promise<void>;
}) => {
  const { mutate, isPending } = useMutation({
    mutationFn: deleteExpense,
    onSuccess: async () => {
      await onSuccess(expense.id);
      onClose();
      enqueueSnackbar("Despesa deletado com sucesso", { variant: "success" });
    },
  });

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Tem certeza que deseja deletar essa despesa?</DialogTitle>
      <DialogContent>
        {expense?.type === "Parcelas" && (
          <b>ATENÇÃO: TODAS AS OUTRAS PARCELAS TAMBÉM SERÃO EXCLUÍDAS!</b>
        )}
        <DialogActions>
          <Button variant="brand-text" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger-text" onClick={() => mutate(expense.id)}>
            {isPending ? <CircularProgress size={24} /> : "Deletar"}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteExpenseDialog;

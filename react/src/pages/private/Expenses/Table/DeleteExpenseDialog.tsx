import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";

import { deleteExpense } from "../api/expenses";
import { Expense } from "../api/models";
import { useState } from "react";

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
  const [
    performActionsOnFutureFixedExpenses,
    setPerformActionsOnFutureFixedExpenses,
  ] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      deleteExpense(expense.id, performActionsOnFutureFixedExpenses),
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
        <Typography
          component="div"
          style={{
            display: expense?.is_fixed ? "" : "none",
          }}
        >
          <FormLabel>Aplicar em despesas futuras?</FormLabel>
          <Grid component="label" container alignItems="center" spacing={1}>
            <Grid item>Não</Grid>
            <Grid item>
              <Switch
                color="primary"
                checked={performActionsOnFutureFixedExpenses}
                onChange={(e) => {
                  setPerformActionsOnFutureFixedExpenses(e.target.checked);
                }}
              />
            </Grid>
            <Grid item>Sim</Grid>
          </Grid>
        </Typography>
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

export default DeleteExpenseDialog;

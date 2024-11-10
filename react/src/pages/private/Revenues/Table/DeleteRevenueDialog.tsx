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

import { deleteRevenue } from "../api";
import { Revenue } from "../models";
import { useState } from "react";

const DeleteRevenueDialog = ({
  revenue,
  open,
  onClose,
  onSuccess,
}: {
  revenue: Revenue & { type: string };
  open: boolean;
  onClose: () => void;
  onSuccess: (id: number) => Promise<void>;
}) => {
  const [
    performActionsOnFutureFixedEntities,
    setperformActionsOnFutureFixedEntities,
  ] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      deleteRevenue(revenue.id, performActionsOnFutureFixedEntities),
    onSuccess: async () => {
      await onSuccess(revenue.id);
      onClose();
      enqueueSnackbar("Receita deletado com sucesso", { variant: "success" });
    },
  });

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Tem certeza que deseja deletar essa receita?</DialogTitle>
      <DialogContent>
        <Typography
          component="div"
          style={{
            display: revenue?.is_fixed ? "" : "none",
          }}
        >
          <FormLabel>Aplicar em receitas futuras?</FormLabel>
          <Grid component="label" container alignItems="center" spacing={1}>
            <Grid item>Não</Grid>
            <Grid item>
              <Switch
                color="primary"
                checked={performActionsOnFutureFixedEntities}
                onChange={(e) => {
                  setperformActionsOnFutureFixedEntities(e.target.checked);
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

export default DeleteRevenueDialog;

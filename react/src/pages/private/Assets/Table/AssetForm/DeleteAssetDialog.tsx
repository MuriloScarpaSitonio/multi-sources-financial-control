import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";

import { deleteAsset } from "../../api";

const DeleteAssetDialog = ({
  id,
  code,
  open,
  onClose,
  onSuccess,
}: {
  id: number;
  code: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { mutate, isPending } = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      onSuccess();
      onClose();
      enqueueSnackbar("Ativo deletado com sucesso", { variant: "success" });
    },
  });
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {`Tem certeza que deseja deletar o ativo ${code}?`}
      </DialogTitle>
      <DialogContent>
        <b>
          ATENÇÃO: TODAS AS TRANSFERÊNCIAS E RENDIMENTOS TAMBÉM SERÃO EXCLUÍDOS!
        </b>
        <DialogActions>
          <Button variant="brand-text" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => mutate(id)}>
            {isPending ? <CircularProgress size={24} /> : "Deletar"}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAssetDialog;

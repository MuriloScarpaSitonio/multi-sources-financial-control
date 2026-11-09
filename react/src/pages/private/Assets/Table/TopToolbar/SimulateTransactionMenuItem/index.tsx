import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import MergeTypeIcon from "@mui/icons-material/MergeType";

import { Colors, Text, getColor } from "../../../../../../design-system";
import { SimulatedAssetResponse } from "../../../api/types";
import SimulatedTransactionTable from "./SimulatedTransactionTable";
import SimulateTransactionForm from "./SimulateTransactionForm";
import { FormData } from "./types";

const FORM_ID = "simulate-asset-transaction-form-id";

const SimulatedTransactionSubTitle = ({
  formData,
}: {
  formData: FormData | null;
}) => {
  return formData?.quantity ? (
    <DialogContentText>{`${formData?.quantity?.toLocaleString(
      "pt-br",
    )} ativos por ${formData?.asset.currency} ${formData?.price?.toLocaleString(
      "pt-br",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      },
    )} (${formData?.asset.currency} ${(
      formData?.price * formData?.quantity
    )?.toLocaleString("pt-br", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })})`}</DialogContentText>
  ) : (
    <DialogContentText>{`Total de ${
      formData?.asset.currency
    } ${formData?.total?.toLocaleString("pt-br", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })} por ${formData?.asset.currency} ${formData?.price?.toLocaleString(
      "pt-br",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      },
    )}  (${(
      (formData?.total as number) / (formData?.price as number)
    )?.toLocaleString("pt-br", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })} ativos)`}</DialogContentText>
  );
};

const SimulateTransactionResponseDialog = ({
  open,
  formData,
  responseData,
  onClose,
}: {
  open: boolean;
  formData: FormData | null;
  responseData: SimulatedAssetResponse | null;
  onClose: () => void;
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        style: {
          backgroundColor: getColor(Colors.neutral600),
          boxShadow: "none",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle>{`Simulação - ${formData?.asset.label}`}</DialogTitle>
      <DialogContent>
        <SimulatedTransactionSubTitle formData={formData} />
        <SimulatedTransactionTable
          simulatedAsset={responseData as SimulatedAssetResponse}
          currencySymbol={formData?.asset.currency}
        />
        <DialogActions>
          <Button onClick={onClose} variant="brand-text">
            Fechar
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

export const SimulateTransactionDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [responseData, setResponseData] =
    useState<SimulatedAssetResponse | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

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
        <Text>Simular transação</Text>
        <SimulateTransactionForm
          id={FORM_ID}
          setResponseData={setResponseData}
          setFormData={setFormData}
          setIsSubmitting={setIsSubmitting}
          onSuccess={() => setOpenDialog(true)}
        />
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <Button onClick={onClose} variant="brand-text">
            Fechar
          </Button>
          <Button type="submit" variant="brand" form={FORM_ID}>
            {isSubmitting ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              "Simular"
            )}
          </Button>
        </Stack>
      </Stack>
      <SimulateTransactionResponseDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        responseData={responseData}
        formData={formData}
      />
    </Drawer>
  );
};

export const SimulateTransactionMenuItem = ({
  onClick,
}: {
  onClick: () => void;
}) => (
  <MenuItem onClick={onClick}>
    <ListItemIcon>
      <MergeTypeIcon />
    </ListItemIcon>
    <ListItemText>Simular transação</ListItemText>
  </MenuItem>
);

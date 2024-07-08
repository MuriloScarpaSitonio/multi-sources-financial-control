import { Dispatch, FunctionComponent, SetStateAction, useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";

import { Colors } from "../enums";
import { getColor } from "../utils";
import Text from "./Text";

const FormDrawer = ({
  title,
  open,
  onClose,
  formId,
  FormComponent,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  formId: string;
  FormComponent: FunctionComponent<{
    id: string;
    setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  }>;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        <Text>{title}</Text>
        <FormComponent id={formId} setIsSubmitting={setIsSubmitting} />
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <Button onClick={onClose} variant="brand-text">
            Fechar
          </Button>
          <Button type="submit" variant="brand" form={formId}>
            {isSubmitting ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              "Adicionar"
            )}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export default FormDrawer;

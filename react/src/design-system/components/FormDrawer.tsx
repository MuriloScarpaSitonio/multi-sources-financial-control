import type {
  Dispatch,
  FunctionComponent,
  SetStateAction,
  ReactNode,
} from "react";
import { useState } from "react";

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
  initialData,
}: {
  title: string | ReactNode;
  open: boolean;
  onClose: () => void;
  formId: string;
  FormComponent: FunctionComponent<{
    id: string;
    setIsSubmitting: Dispatch<SetStateAction<boolean>>;
    setIsDisabled?: Dispatch<SetStateAction<boolean>>;
    initialData?: any;
    onEditSuccess?: () => void;
  }>;
  initialData?: any;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  const label = initialData ? "Editar" : "Adicionar";
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
        {typeof title === "string" ? <Text>{title}</Text> : title}
        <FormComponent
          id={formId}
          setIsSubmitting={setIsSubmitting}
          setIsDisabled={setIsDisabled}
          initialData={initialData}
          onEditSuccess={onClose}
        />
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <Button onClick={onClose} variant="brand-text">
            Fechar
          </Button>
          <Button
            type="submit"
            variant="brand"
            form={formId}
            disabled={isDisabled}
          >
            {isSubmitting ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              label
            )}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export default FormDrawer;

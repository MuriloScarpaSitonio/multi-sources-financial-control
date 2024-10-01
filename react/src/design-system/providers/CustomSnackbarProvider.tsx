import Slide from "@mui/material/Slide";
import IconButton from "@mui/material/IconButton";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { styled } from "@mui/system";

import {
  MaterialDesignContent,
  SnackbarProvider,
  closeSnackbar,
} from "notistack";

import { Colors } from "../enums";
import { getColor } from "../utils";

const StyledMaterialDesignContent = styled(MaterialDesignContent)(() => ({
  "&.notistack-MuiContent-success": {
    backgroundColor: getColor(Colors.brand950),
    color: getColor(Colors.neutral0),
  },
  "&.notistack-MuiContent-error": {
    backgroundColor: getColor(Colors.danger200),
    color: getColor(Colors.neutral0),
  },
}));

const CustomSnackbarProvider = () => (
  <SnackbarProvider
    autoHideDuration={5000}
    anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    TransitionComponent={Slide}
    disableWindowBlurListener
    action={(snackbarId) => (
      <IconButton onClick={() => closeSnackbar(snackbarId)} size="small">
        <CloseIcon fontSize="inherit" />
      </IconButton>
    )}
    iconVariant={{
      success: (
        <CheckIcon
          fontSize="inherit"
          sx={{
            color: getColor(Colors.brand300),
            mr: 1,
          }}
        />
      ),
    }}
    Components={{
      success: StyledMaterialDesignContent,
      error: StyledMaterialDesignContent,
    }}
  />
);

export default CustomSnackbarProvider;

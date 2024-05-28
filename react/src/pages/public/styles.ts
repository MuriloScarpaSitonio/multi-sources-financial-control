import { buttonClasses } from "@mui/material/Button";
import { outlinedInputClasses } from "@mui/material/OutlinedInput";
import { createTheme } from "@mui/material/styles";

import { Colors } from "../../design-system/enums";
import { getColor } from "../../design-system/utils";

export const theme = createTheme({
  components: {
    MuiTypography: {
      styleOverrides: {
        root: {
          color: getColor(Colors.neutral0),
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          [`&.${buttonClasses.outlined}.${buttonClasses.colorSuccess}`]: {
            borderRadius: "5px",
            border: `2px solid ${getColor(Colors.brand)}`,
            color: getColor(Colors.neutral0),
            textTransform: "none",
            padding: "12px",
            "&:hover": {
              border: `2px solid ${getColor(Colors.brand100)}`,
            },
          },
          [`&.${buttonClasses.contained}.${buttonClasses.colorSuccess}`]: {
            borderRadius: "5px",
            background: getColor(Colors.brand),
            color: getColor(Colors.neutral900),
            textTransform: "none",
            "&:hover": {
              background: getColor(Colors.brand200),
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          color: getColor(Colors.neutral0),
          "&::before, &::after": {
            backgroundColor: getColor(Colors.neutral0),
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: "5px",
          border: `2px solid ${getColor(Colors.brand)}`,
          input: {
            color: getColor(Colors.neutral300),
            "&::placeholder": {
              color: getColor(Colors.neutral300),
            },
          },
          "&:hover": {
            border: `2px solid ${getColor(Colors.brand100)}`,
            "& input": {
              color: getColor(Colors.neutral0),
            },
            "& input::placeholder": {
              color: getColor(Colors.neutral0),
            },
          },
          "& > fieldset": {
            border: "none",
          },
          [`&.${outlinedInputClasses.error}`]: {
            borderRadius: "5px",
            border: `2px solid ${getColor(Colors.danger200)}`,
            "&:hover": {
              border: `2px solid ${getColor(Colors.danger100)}`,
              "& input::placeholder": {
                color: getColor(Colors.neutral0),
              },
            },
          },
          [`&.${outlinedInputClasses.focused}.${outlinedInputClasses.error}`]: {
            borderRadius: "5px",
            border: `2px solid ${getColor(Colors.danger200)}`,
            background: getColor(Colors.neutral700),
          },
          [`&.${outlinedInputClasses.focused}`]: {
            borderRadius: "5px",
            border: `2px solid ${getColor(Colors.brand)}`,
            background: getColor(Colors.neutral700),
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: getColor(Colors.neutral300),
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: getColor(Colors.neutral300),
        },
      },
    },
  },
});

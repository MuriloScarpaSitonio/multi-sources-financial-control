import { buttonClasses } from "@mui/material/Button";
import { checkboxClasses } from "@mui/material/Checkbox";
import { formLabelClasses } from "@mui/material/FormLabel";
import { inputClasses } from "@mui/material/Input";
import { radioClasses } from "@mui/material/Radio";
import { createTheme } from "@mui/material/styles";

import { Colors, FontWeights } from "./enums";
import { getColor, getFontWeight } from "./utils";

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    brand: true;
    "brand-text": true;
    danger: true;
    "danger-text": true;
    neutral: true;
    "neutral-text": true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsVariantOverrides {
    brand: true;
    "brand-selected": true;
    neutral: true;
    "neutral-selected": true;
  }
}

const theme = createTheme({
  palette: { mode: "dark" },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          [`&.${radioClasses.checked}`]: {
            color: getColor(Colors.brand200),
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        colorPrimary: {
          "&.Mui-checked": {
            color: getColor(Colors.brand200),
          },
        },
        track: {
          ".Mui-checked.Mui-checked + &": {
            opacity: 0.7,
            backgroundColor: getColor(Colors.brand200),
          },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          [`&.${formLabelClasses.focused}`]: {
            color: getColor(Colors.brand200),
          },
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        root: {
          [`&.${inputClasses.focused}`]: {
            "&::after": {
              borderBottomColor: getColor(Colors.brand200),
            },
          },
        },
      },
    },
    MuiButton: {
      variants: [
        {
          props: { variant: "brand" },
          style: {
            background: getColor(Colors.brand),
            color: getColor(Colors.neutral900),
            borderRadius: "5px",
            fontWeight: getFontWeight(FontWeights.MEDIUM),
            "&:hover": { background: getColor(Colors.brand400) },
            [`&.${buttonClasses.disabled}`]: {
              background: "none",
            },
          },
        },
        {
          props: { variant: "brand-text" },
          style: {
            color: getColor(Colors.brand),
            borderRadius: "5px",
            fontWeight: getFontWeight(FontWeights.MEDIUM),
            "&:hover": {
              background: getColor(Colors.brand),
              color: getColor(Colors.neutral900),
            },
          },
        },
        {
          props: { variant: "brand", size: "large" },
          style: {
            background: getColor(Colors.brand),
            color: getColor(Colors.neutral900),
            borderRadius: "5px",
            padding: "10px 31px",
            fontWeight: getFontWeight(FontWeights.MEDIUM),
            "&:hover": { background: getColor(Colors.brand400) },
          },
        },
        {
          props: { variant: "neutral" },
          style: {
            background: getColor(Colors.neutral400),
            color: getColor(Colors.neutral0),
            borderRadius: "5px",
            "&:hover": { background: getColor(Colors.neutral600) },
          },
        },
        {
          props: { variant: "neutral-text" },
          style: {
            color: getColor(Colors.neutral0),
            borderRadius: "5px",
            "&:hover": { background: getColor(Colors.neutral600) },
          },
        },
        {
          props: { variant: "danger" },
          style: {
            background: getColor(Colors.danger200),
            color: getColor(Colors.neutral900),
            borderRadius: "5px",
            fontWeight: getFontWeight(FontWeights.MEDIUM),
            "&:hover": { background: getColor(Colors.danger100) },
          },
        },
        {
          props: { variant: "danger-text" },
          style: {
            color: getColor(Colors.danger200),
            borderRadius: "5px",
            fontWeight: getFontWeight(FontWeights.MEDIUM),
            "&:hover": {
              background: getColor(Colors.danger200),
              color: getColor(Colors.neutral900),
            },
          },
        },
      ],
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          [`&.${checkboxClasses.checked}`]: {
            color: getColor(Colors.brand),
          },
        },
      },
    },
    MuiChip: {
      variants: [
        {
          props: { variant: "brand-selected" },
          style: {
            background: getColor(Colors.brand600),
            color: getColor(Colors.neutral200),
          },
        },
        {
          props: { variant: "brand" },
          style: {
            background: getColor(Colors.brand200),
            color: getColor(Colors.neutral700),
            borderRadius: "16px",
            "& .MuiChip-icon": {
              color: getColor(Colors.neutral700),
            },
            "& .MuiChip-deleteIcon": {
              color: getColor(Colors.neutral700),
            },
            "&:hover": {
              background: getColor(Colors.brand600),
              color: getColor(Colors.neutral200),
              "& .MuiChip-icon": {
                color: getColor(Colors.neutral200),
              },
              "& .MuiChip-deleteIcon": {
                color: getColor(Colors.neutral200),
              },
            },
          },
        },
        {
          props: { variant: "neutral" },
          style: {
            background: getColor(Colors.neutral600),
            color: getColor(Colors.neutral200),
            "&:hover": { background: getColor(Colors.neutral400) },
          },
        },
        {
          props: { variant: "neutral-selected" },
          style: {
            background: getColor(Colors.neutral400),
            color: getColor(Colors.neutral200),
          },
        },
      ],
      styleOverrides: {
        root: { borderRadius: "8px" },
      },
    },
  },
});

export default theme;

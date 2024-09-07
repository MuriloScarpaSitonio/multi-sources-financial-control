import { ReactNode, useState } from "react";

import MuiAlert from "@mui/lab/Alert";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Link from "@mui/material/Link";
import { checkboxClasses } from "@mui/material/Checkbox";
import { formLabelClasses } from "@mui/material/FormLabel";
import { inputClasses } from "@mui/material/Input";
import { radioClasses } from "@mui/material/Radio";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import NavBar from "./NavBar";
import SideBar from "./SideBar";
import { stringToBoolean } from "../../../helpers";
import {
  Colors,
  FontWeights,
  CustomSnackbarProvider,
  getColor,
  getFontWeight,
} from "../../../design-system";

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    brand: true;
    "brand-text": true;
    danger: true;
    "danger-text": true;
    neutral: true;
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

type ReactNodeConstructor = ReactNode & { name: string };

const Wrapper = ({ children }: { children: ReactNodeConstructor }) => {
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

  const trialWillEndMessage = localStorage.getItem(
    "user_trial_will_end_message",
  );

  const [showAlert, setShowAlert] = useState(
    stringToBoolean(trialWillEndMessage),
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CustomSnackbarProvider />
      <Box
        sx={{
          display: "flex",
          // background: getColor(Colors.neutral600),
        }}
      >
        <NavBar />
        <SideBar />
        <Box
          sx={{
            flex: 1,
            mt: 11, // navbar height + 3
            ml: 27, // sidebar width + 4
            mr: 8,
            // height: "100%",
          }}
        >
          {showAlert && (
            <MuiAlert
              elevation={6}
              variant="outlined"
              severity="warning"
              onClose={() => setShowAlert(false)}
            >
              <div>
                {trialWillEndMessage}
                {children.name !== "User" && (
                  <span>
                    Vá até suas <Link href="/me?tab=1">configuraçōes</Link> para
                    incluir ou alterar seus dados de cobrança
                  </span>
                )}
              </div>
            </MuiAlert>
          )}
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default Wrapper;

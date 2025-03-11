import { ReactNode, useState } from "react";

import MuiAlert from "@mui/lab/Alert";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Link from "@mui/material/Link";
import { ThemeProvider } from "@mui/material/styles";

import NavBar from "./NavBar";
import SideBar from "./SideBar";
import { stringToBoolean } from "../../../helpers";
import { CustomSnackbarProvider, theme } from "../../../design-system";

type ReactNodeConstructor = ReactNode & { name: string };

const Wrapper = ({ children }: { children: ReactNodeConstructor }) => {
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
      <Box sx={{ display: "flex" }}>
        <NavBar />
        <SideBar />
        <Box
          sx={{
            flex: 1,
            mt: 11, // navbar height + 3
            ml: 27, // sidebar width + 4
            mr: 8,
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

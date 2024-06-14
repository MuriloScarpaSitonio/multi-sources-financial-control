import { ReactNode, useState } from "react";

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import MuiAlert from "@mui/lab/Alert";

import NavBar from "./NavBar";
import SideBar from "./SideBar";
import { stringToBoolean } from "../../../helpers";
import { Colors } from "../../../design-system/enums";
import { getColor } from "../../../design-system/utils";

type ReactNodeConstructor = ReactNode & { name: string };

const Wrapper = ({ children }: { children: ReactNodeConstructor }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");

  const [showAlert, setShowAlert] = useState(
    stringToBoolean(trialWillEndMessage),
  );
  return (
    <Box
      sx={{
        display: "flex",
        background: getColor(Colors.neutral600),
        height: "100%",
      }}
    >
      <NavBar />
      <SideBar />
      <Box
        sx={{
          flex: 1,
          mt: 11, // navbar height + 3
          ml: 34, // sidebar width + 4
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
  );
};

export default Wrapper;

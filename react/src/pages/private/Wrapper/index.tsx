import { ReactNode, useState } from "react";

import Container from "@mui/material/Box";
import Link from "@mui/material/Link";
import MuiAlert from "@mui/lab/Alert";

import NavBar from "./NavBar";
import SideBar from "./SideBar";
import { stringToBoolean } from "../../../helpers";

type ReactNodeConstructor = ReactNode & { name: string };

const Wrapper = ({ children }: { children: ReactNodeConstructor }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");

  const [showAlert, setShowAlert] = useState(
    stringToBoolean(trialWillEndMessage),
  );
  return (
    <>
      <NavBar />
      <SideBar />
      <div className="base">
        <Container style={{ marginTop: "15px" }}>
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
        </Container>
      </div>
    </>
  );
};

export default Wrapper;

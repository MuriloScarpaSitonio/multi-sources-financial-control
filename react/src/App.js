import React from "react";

import Container from "@mui/material/Container";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Link from "@mui/material/Link";
import MuiAlert from "@mui/lab/Alert";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Navbar } from "./components/Navbar";
import { useHideValues } from "./hooks/useHideValues";
import { ActivateUser } from "./pages/ActivateUser";
import Assets from "./pages/Assets";
import Expenses from "./pages/Expenses";
import Home from "./pages/Home";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ForgotPasswordDone } from "./pages/ForgotPasswordDone";
import { ResetPassword } from "./pages/ResetPassword";
import { Signup } from "./pages/Signup";
import { SignupDone } from "./pages/SignupDone";
import { SubscriptionDone } from "./pages/SubscriptionDone";
import PassiveIncomes from "./pages/PassiveIncomes";
import Revenues from "./pages/Revenues";
import Subscription from "./pages/Subscription";
import Transactions from "./pages/Transactions";
import User from "./pages/User";
import { stringToBoolean } from "./helpers.js";
import { AccessTokenStr } from "./consts";

const queryClient = new QueryClient();

const PrivateRoute = ({ children, path }) => {
  const isLoggedIn = Boolean(localStorage.getItem(AccessTokenStr));
  const isSubscriptionCanceled =
    localStorage.getItem("user_subscription_status") === "CANCELED";
  if (isLoggedIn) {
    if (
      isSubscriptionCanceled &&
      !["Subscription", "SubscriptionDone", "User"].includes(children.name)
    ) {
      return (
        <Navigate to={{ pathname: "/subscription", state: { from: path } }} />
      );
    } else return <Wrapper isLoggedIn={true}>{children}</Wrapper>;
  } else return <Navigate to={{ pathname: "/", state: { from: path } }} />;
};

const Wrapper = ({ children, isLoggedIn }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");
  const [showAlert, setShowAlert] = React.useState(
    stringToBoolean(trialWillEndMessage),
  );

  const hideValuesToggler = useHideValues();
  return (
    <div>
      <div
        className="base"
        style={isLoggedIn && { backgroundColor: "whitesmoke" }}
      >
        {isLoggedIn && <Navbar hideValuesToggler={hideValuesToggler} />}
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
    </div>
  );
};

export default function App() {
  const isLoggedIn = Boolean(localStorage.getItem(AccessTokenStr));
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Wrapper Component={Signup} />} />
          <Route
            path="/signup/done"
            element={<Wrapper Component={SignupDone} />}
          />
          <Route
            path="/activate/:uidb64/:token"
            element={<Wrapper Component={ActivateUser} />}
          />
          <Route
            path="/forgot_password"
            element={<Wrapper Component={ForgotPassword} />}
          />
          <Route
            path="/forgot_password/done"
            element={<Wrapper Component={ForgotPasswordDone} />}
          />
          <Route
            path="/reset_password/:uidb64/:token"
            element={<Wrapper Component={ResetPassword} />}
          />
          <Route
            path="/home"
            element={
              <PrivateRoute path="/home">
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <PrivateRoute path="/expenses">
                <Expenses />
              </PrivateRoute>
            }
          />
          <Route
            path="/revenues"
            element={
              <PrivateRoute path="/revenues">
                <Revenues />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets"
            element={
              <PrivateRoute path="/assets">
                <Assets />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets/transactions"
            element={
              <PrivateRoute path="/assets/transactions">
                <Transactions />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets/incomes"
            element={
              <PrivateRoute path="/assets/incomes">
                <PassiveIncomes />
              </PrivateRoute>
            }
          />
          <Route
            path="/me"
            element={
              <PrivateRoute path="/me">
                <User />
              </PrivateRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <PrivateRoute path="/subscription">
                <Subscription />
              </PrivateRoute>
            }
          />
          <Route
            path="/subscription/done"
            element={
              <PrivateRoute path="/subscription/done">
                <SubscriptionDone />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

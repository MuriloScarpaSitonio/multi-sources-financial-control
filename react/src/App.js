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

import "./App.css";

const getRoute = ({
  Component,
  pathname,
  isLoggedIn,
  isSubscriptionCanceled,
}) => {
  if (isLoggedIn) {
    if (
      isSubscriptionCanceled &&
      !["Subscription", "SubscriptionDone", "User"].includes(Component.name)
    ) {
      return (
        <Navigate
          to={{ pathname: "/subscription", state: { from: pathname } }}
        />
      );
    } else return <Wrapper isLoggedIn={true} Component={Component} />
  } else <Navigate to={{ pathname: "/", state: { from: pathname } }} />
};

const Wrapper = ({ isLoggedIn, Component }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");
  const [showAlert, setShowAlert] = React.useState(stringToBoolean(trialWillEndMessage));

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
                {Component.name !== "User" && (
                  <span>
                    Vá até suas <Link href="/me?tab=1">configuraçōes</Link> para
                    incluir ou alterar seus dados de cobrança
                  </span>
                )}
              </div>
            </MuiAlert>
          )}
          <Component />
        </Container>
      </div>
    </div>
  );
};

export default function App() {
  const isLoggedIn = Boolean(localStorage.getItem(AccessTokenStr));
  const isSubscriptionCanceled =
    localStorage.getItem("user_subscription_status") === "CANCELED";

  return (
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
          element={getRoute({
            Component: Home,
            pathname: "/home",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/expenses"
          element={getRoute({
            Component: Expenses,
            pathname: "/expenses",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/assets"
          element={getRoute({
            Component: Assets,
            pathname: "/assets",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/revenues"
          element={getRoute({
            Component: Revenues,
            pathname: "/revenues",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/assets/transactions"
          element={getRoute({
            Component: Transactions,
            pathname: "/assets/transactions",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/assets/incomes"
          element={getRoute({
            Component: PassiveIncomes,
            pathname: "/assets/incomes",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/me"
          element={getRoute({
            Component: User,
            pathname: "/home",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/subscription"
          element={getRoute({
            Component: Subscription,
            pathname: "/subscription",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
        <Route
          path="/subscription/done"
          element={getRoute({
            Component: SubscriptionDone,
            pathname: "/subscription/done",
            isLoggedIn,
            isSubscriptionCanceled,
          })}
        />
      </Routes>
    </Router>
  );
}

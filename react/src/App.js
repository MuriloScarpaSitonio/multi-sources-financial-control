import React from "react";

import MuiAlert from "@mui/lab/Alert";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import { Navbar } from "./components/Navbar";
import { AccessTokenStr, RefreshTokenStr } from "./consts";
import { stringToBoolean } from "./helpers.js";
import { useHideValues } from "./hooks/useHideValues";
import { ActivateUser } from "./pages/ActivateUser";
import {
  Assets,
  Expenses,
  Home,
  Incomes,
  Transactions,
  Wrapper as WrapperV2,
} from "./pages/private";
import { ForgotPassword, Login, Signup } from "./pages/public";
import { ResetPassword } from "./pages/ResetPassword";
import Subscription from "./pages/Subscription";
import { SubscriptionDone } from "./pages/SubscriptionDone";
import User from "./pages/User";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    const { exp } = JSON.parse(jsonPayload);
    return exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
};

const useLocalStorageBooleanValues = () => {
  const token = localStorage.getItem(AccessTokenStr);
  const refreshToken = localStorage.getItem(RefreshTokenStr);

  // If no tokens exist, user is definitely not logged in
  if (!token || !refreshToken) {
    return {
      isLoggedIn: false,
      isSubscriptionCanceled: false,
    };
  }

  // If access token is expired, check refresh token
  if (isTokenExpired(token)) {
    // If refresh token is also expired, clear everything and log out
    if (isTokenExpired(refreshToken)) {
      localStorage.removeItem(AccessTokenStr);
      localStorage.removeItem(RefreshTokenStr);
      localStorage.removeItem("user_subscription_status");
      return {
        isLoggedIn: false,
        isSubscriptionCanceled: false,
      };
    }
    // If refresh token is still valid, stay logged in and let axios handle refresh
  }

  return {
    isLoggedIn: true,
    isSubscriptionCanceled:
      localStorage.getItem("user_subscription_status") === "CANCELED",
  };
};

const PublicRoute = ({ children, path }) => {
  const { isLoggedIn, isSubscriptionCanceled } = useLocalStorageBooleanValues();

  if (isLoggedIn) {
    if (
      isSubscriptionCanceled &&
      !["Subscription", "SubscriptionDone", "User"].includes(children.name)
    ) {
      return (
        <Navigate to={{ pathname: "/subscription", state: { from: path } }} />
      );
    } else return <Navigate to="/home" />;
  } else return children;
};

const PrivateRoute = ({ children, path, v2 }) => {
  const { isLoggedIn, isSubscriptionCanceled } = useLocalStorageBooleanValues();

  if (isLoggedIn) {
    if (
      isSubscriptionCanceled &&
      !["Subscription", "SubscriptionDone", "User"].includes(children.name)
    ) {
      return (
        <Navigate to={{ pathname: "/subscription", state: { from: path } }} />
      );
    } else
      return v2 ? (
        <WrapperV2>{children}</WrapperV2>
      ) : (
        <Wrapper isLoggedIn>{children}</Wrapper>
      );
  } else return <Navigate to={{ pathname: "/", state: { from: path } }} />;
};

const Wrapper = ({ children, isLoggedIn }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");
  const [showAlert, setShowAlert] = React.useState(
    stringToBoolean(trialWillEndMessage),
  );

  const hideValuesToggler = useHideValues();
  return (
    <div style={isLoggedIn && { backgroundColor: "whitesmoke" }}>
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
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router basename="/">
        <Routes>
          <Route
            path="/"
            element={
              <PublicRoute path="/">
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute path="/signup">
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/activate/:uidb64/:token"
            element={
              <PublicRoute path="/activate/:uidb64/:token">
                <ActivateUser />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot_password"
            element={
              <PublicRoute path="/forgot_password">
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset_password/:uidb64/:token"
            element={
              <PublicRoute path="/reset_password/:uidb64/:token">
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/home"
            element={
              <PrivateRoute path="/home" v2>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <PrivateRoute path="/expenses" v2>
                <Expenses />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets"
            element={
              <PrivateRoute path="/assets" v2>
                <Assets />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets/transactions"
            element={
              <PrivateRoute path="/assets/transactions" v2>
                <Transactions />
              </PrivateRoute>
            }
          />
          <Route
            path="/assets/incomes"
            element={
              <PrivateRoute path="/assets/incomes" v2>
                <Incomes />
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

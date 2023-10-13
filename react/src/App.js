import React from "react";

import Container from "@material-ui/core/Container";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";
import Link from "@material-ui/core/Link";
import MuiAlert from "@material-ui/lab/Alert";

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

const Wrapper = ({ isLoggedIn, ...props }) => {
  let trialWillEndMessage = localStorage.getItem("user_trial_will_end_message");
  const [showAlert, setShowAlert] = React.useState(
    props.component.name !== "Login" && stringToBoolean(trialWillEndMessage)
  );

  const hideValuesToggler = useHideValues();
  return (
    <div>
      <div
        className="base"
        style={isLoggedIn && { backgroundColor: "whitesmoke" }}
      >
        {isLoggedIn && (
          <Navbar hideValuesToggler={hideValuesToggler} {...props} />
        )}
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
                {props.component.name !== "User" && (
                  <span>
                    Vá até suas <Link href="/me?tab=1">configuraçōes</Link> para
                    incluir ou alterar seus dados de cobrança
                  </span>
                )}
              </div>
            </MuiAlert>
          )}
          <props.component {...props} />
        </Container>
      </div>
    </div>
  );
};

const PrivateRoute = ({ component, ...rest }) => {
  const isLoggedIn = Boolean(localStorage.getItem(AccessTokenStr));
  const isSubscriptionDisabled =
    localStorage.getItem("user_subscription_status") === "CANCELED";

  function getRoute(props, component) {
    if (isLoggedIn) {
      if (
        isSubscriptionDisabled &&
        !["Subscription", "SubscriptionDone", "User"].includes(component.name)
      ) {
        return (
          <Redirect
            to={{ pathname: "/subscription", state: { from: props.location } }}
          />
        );
      } else {
        return <Wrapper {...props} isLoggedIn={true} component={component} />;
      }
    } else {
      return (
        <Redirect to={{ pathname: "/", state: { from: props.location } }} />
      );
    }
  }
  return <Route {...rest} render={(props) => getRoute(props, component)} />;
};

export default function App() {
  return (
    <Router>
      <Switch>
        <Route
          exact
          path="/"
          render={(props) => <Wrapper {...props} component={Login} />}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/signup"
          render={(props) => <Wrapper {...props} component={Signup} />}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/signup/done"
          render={(props) => <Wrapper {...props} component={SignupDone} />}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/activate/:uidb64/:token"
          render={(props) => <Wrapper {...props} component={ActivateUser} />}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/forgot_password"
          render={(props) => <Wrapper {...props} component={ForgotPassword} />}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/forgot_password/done"
          render={(props) => (
            <Wrapper {...props} component={ForgotPasswordDone} />
          )}
        />
      </Switch>
      <Switch>
        <Route
          exact
          path="/reset_password/:uidb64/:token"
          render={(props) => <Wrapper {...props} component={ResetPassword} />}
        />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/home" component={Home} />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/expenses" component={Expenses} />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/assets" component={Assets} />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/revenues" component={Revenues} />
      </Switch>
      <Switch>
        <PrivateRoute
          exact
          path="/assets/transactions"
          component={Transactions}
        />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/assets/incomes" component={PassiveIncomes} />
      </Switch>
      <Switch>
        <PrivateRoute path="/me" component={User} />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/subscription" component={Subscription} />
      </Switch>
      <Switch>
        <PrivateRoute
          exact
          path="/subscription/done"
          component={SubscriptionDone}
        />
      </Switch>
    </Router>
  );
}

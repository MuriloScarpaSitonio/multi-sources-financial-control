import React from "react";

import Container from "@material-ui/core/Container";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";

import { Navbar } from "./components/Navbar";
import { useHideValues } from "./hooks/useHideValues";
import { ActivateUser } from "./pages/ActivateUser";
import Assets from "./pages/Assets";
import Expenses from "./pages/Expenses";
import Home from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { SignupDone } from "./pages/SignupDone";
import PassiveIncomes from "./pages/PassiveIncomes";
import Revenues from "./pages/Revenues";
import Transactions from "./pages/Transactions";
import User from "./pages/User";

import { AccessTokenStr } from "./consts";

import "./App.css";

const Wrapper = ({ isLoggedIn, ...props }) => {
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
          <props.component {...props} />
        </Container>
      </div>
    </div>
  );
};

const PrivateRoute = ({ component: Component, ...rest }) => {
  const isLoggedIn = Boolean(localStorage.getItem(AccessTokenStr));

  return (
    <Route
      {...rest}
      render={(props) =>
        isLoggedIn ? (
          <Wrapper {...props} isLoggedIn={isLoggedIn} component={Component} />
        ) : (
          <Redirect to={{ pathname: "/", state: { from: props.location } }} />
        )
      }
    />
  );
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
        <Route
          exact
          path="/signup"
          render={(props) => <Wrapper {...props} component={Signup} />}
        />
        <Route
          exact
          path="/signup/done"
          render={(props) => <Wrapper {...props} component={SignupDone} />}
        />
        <Route
          exact
          path="/activate/:uidb64/:token"
          render={(props) => <Wrapper {...props} component={ActivateUser} />}
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
        <PrivateRoute exact path="/me" component={User} />
      </Switch>
    </Router>
  );
}

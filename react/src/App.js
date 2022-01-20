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
import Assets from "./pages/Assets";
import Expenses from "./pages/Expenses";
import { Login } from "./pages/Login";

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
        {isLoggedIn && <Navbar hideValuesToggler={hideValuesToggler} />}
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
      </Switch>
      <Switch>
        <PrivateRoute exact path="/expenses" component={Expenses} />
      </Switch>
      <Switch>
        <PrivateRoute exact path="/assets" component={Assets} />
      </Switch>
    </Router>
  );
}

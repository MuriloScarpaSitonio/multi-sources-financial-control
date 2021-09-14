import React from "react"

import { BrowserRouter as Router, Switch, Route } from "react-router-dom"

import Expenses from "./pages/Expenses"
import { Login } from "./pages/Login"

import "./App.css"

const Wrapper = (props) => {
  return (
    <div>
      <div className="base">
        <props.component {...props} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/"
          render={props => (
            <Wrapper {...props} component={Login} />
          )}
        />
      </Switch>
      <Switch>
        <Route exact path="/expenses"
          render={props => (
            <Wrapper {...props} component={Expenses} />
          )}
        />
      </Switch>
    </Router>
  )
}
import { useState, useEffect } from "react";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import CircularProgress from "@material-ui/core/CircularProgress";
import Container from "@material-ui/core/Container";
import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";

import { UserApi } from "../api";
import { setUserDataToLocalStorage } from "../helpers.js";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

export const SubscriptionDone = () => {
  const [subscriptionDataWasUpdated, setSubscriptionDataWasUpdated] =
    useState(false);

  const subscriptionUpdatedAt = new Date(
    localStorage.getItem("user_stripe_subscription_updated_at")
  );
  const classes = useStyles();
  const history = useHistory();
  const api = new UserApi(localStorage.getItem("user_id"));

  useEffect(() => {
    function checkUserStatus() {
      api.retrieve().then((response) => {
        if (
          new Date(response.data.stripe_subscription_updated_at) >
          subscriptionUpdatedAt
        ) {
          setUserDataToLocalStorage(response.data);
          setSubscriptionDataWasUpdated(true);
        }
      });
    }

    const interval = setInterval(() => checkUserStatus(), 10 * 1000); // 10 seconds
    return () => clearTimeout(interval);
  }, [history]);

  if (subscriptionDataWasUpdated) setTimeout(() => history.push("/"), 1000);
  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h4">
          Obrigado pelo cadastro!
        </Typography>
        <Typography component="h1" variant="h6">
          Estamos esperando a confirmação do Stripe. Não deve demorar muito, mas
          se você não for redirecionado em breve você pode tentar{" "}
          <Link href="/" variant="body2">
            fazer login novamente
          </Link>
          . Se ainda assim não conseguir acessar a plataforma, nos contate
          através do email test@test.com
        </Typography>
      </div>
      {subscriptionDataWasUpdated ? (
        <Typography component="h1" variant="h6">
          Tudo certo! Redirecionando...
        </Typography>
      ) : (
        <CircularProgress size={38} />
      )}
    </Container>
  );
};

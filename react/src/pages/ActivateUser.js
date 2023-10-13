import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

import { AuthenticationApi } from "../api";
import { Loader } from "../components/Loaders";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

const TOKEN = "activate-user";
const INTERNAL_ACTIVATE_USER_SESSION_TOKEN = "_activate_user_token";

export const ActivateUser = (props) => {
  const [error, setError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  let { uidb64, token } = useParams();
  const history = useHistory();
  const classes = useStyles();

  useEffect(() => {
    if (token !== TOKEN) {
      // Store the token in the session and redirect to the
      // URL without the token. This avoids the possibility of leaking the token in the
      // HTTP Referer header.
      sessionStorage.setItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN, token);
      history.push(history.location.pathname.replace(token, TOKEN));
      return;
    }
    new AuthenticationApi()
      .activateUser(
        uidb64,
        sessionStorage.getItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN)
      )
      .then(() => {
        sessionStorage.removeItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN);
        setTimeout(() => history.push("/"), 1200);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoaded(true));
  }, [uidb64, token, history]);

  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        {!isLoaded ? (
          <Loader />
        ) : (
          <>
            {error ? (
              <Typography component="h1" variant="h5">
                Token inválido
              </Typography>
            ) : (
              <>
                <Typography component="h1" variant="h5">
                  Conta ativada!
                </Typography>
                <Typography component="h1" variant="h5">
                  Você será redirecionado em breve...
                </Typography>
              </>
            )}
            <Link href="/" variant="body2">
              Retornar a página de login
            </Link>
          </>
        )}
      </div>
    </Container>
  );
};

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { makeStyles } from "@mui/styles";
import Container from "@mui/material/Container";

import { AuthenticationApi } from "../api";
import { Loader } from "../components/Loaders";

const useStyles = makeStyles((theme) => ({
  paper: {
    // marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

const TOKEN = "activate-user";
const INTERNAL_ACTIVATE_USER_SESSION_TOKEN = "_activate_user_token";

export const ActivateUser = () => {
  const [error, setError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  let { uidb64, token } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const classes = useStyles();

  useEffect(() => {
    if (token !== TOKEN) {
      // Store the token in the session and redirect to the
      // URL without the token. This avoids the possibility of leaking the token in the
      // HTTP Referer header.
      sessionStorage.setItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN, token);
      navigate(pathname.replace(token, TOKEN), { replace: true });
      return;
    }
    new AuthenticationApi()
      .activateUser(
        uidb64,
        sessionStorage.getItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN)
      )
      .then(() => {
        sessionStorage.removeItem(INTERNAL_ACTIVATE_USER_SESSION_TOKEN);
        setTimeout(() => navigate("/"), 1200);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoaded(true));
  }, [uidb64, token, navigate, pathname]);

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

import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";
import Container from "@mui/material/Container";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { AuthenticationApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

const useStyles = makeStyles((theme) => ({
  paper: {
    // marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  form: {
    width: "100%", // Fix IE 11 issue.
    // marginTop: theme.spacing(1),
  },
  submit: {
    // margin: theme.spacing(3, 0, 2),
  },
}));

const schema = yup.object().shape({
  password: yup.string().min(4).required("Campo obrigatório"),
  password2: yup
    .string()
    .min(4)
    .oneOf([yup.ref("password"), null], "As senhas precisam ser iguais"),
});

const TOKEN = "reset-password";
const INTERNAL_RESET_PASSWORD_SESSION_TOKEN = "_reset_password_token";

export const ResetPassword = () => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  let { uidb64, token } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const classes = useStyles();

  if (token !== TOKEN) {
    // Store the token in the session and redirect to the
    // URL without the token. This avoids the possibility of leaking the token in the
    // HTTP Referer header.
    sessionStorage.setItem(INTERNAL_RESET_PASSWORD_SESSION_TOKEN, token);
    navigate(pathname.replace(token, TOKEN), { replace: true });
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });

  const onSubmit = (data) => {
    setIsLoaded(false);
    new AuthenticationApi()
      .resetPassword(uidb64, {
        ...data,
        token: sessionStorage.getItem(INTERNAL_RESET_PASSWORD_SESSION_TOKEN),
      })
      .then(() => {
        sessionStorage.removeItem(INTERNAL_RESET_PASSWORD_SESSION_TOKEN);
        setAlertInfos({
          message: "Sucesso! Redirecionando...",
          severity: "success",
        });
        setTimeout(() => navigate("/"), 1200);
      })
      .catch((error) => {
        setAlertInfos({
          message: JSON.stringify(error.response.data),
          severity: "error",
        });
        reset({ password: "", password2: "" });
      })
      .finally(() => {
        setIsLoaded(true);
        setShowAlert(true);
      });
  };

  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h5">
          Redefinir senha
        </Typography>
        <form className={classes.form}>
          <Controller
            name="password"
            id="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                variant="outlined"
                margin="normal"
                required
                fullWidth
                label="Senha"
                type="password"
                error={!!errors.password}
                helperText={errors.password?.message}
              />
            )}
          />
          <Controller
            name="password2"
            id="password2"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                variant="outlined"
                margin="normal"
                required
                fullWidth
                label="Senha (de novo)"
                type="password"
                error={!!errors.password2}
                helperText={errors.password2?.message}
              />
            )}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
            onClick={handleSubmit(onSubmit)}
          >
            {isLoaded ? (
              "Redefinir"
            ) : (
              <CircularProgress size={24} style={{ color: "white" }} />
            )}
          </Button>
          <Grid container>
            <Grid item xs>
              <Link href="/" variant="body2">
                Retornar a página de login
              </Link>
            </Grid>
          </Grid>
          <FormFeedback
            open={showAlert}
            onClose={() => setShowAlert(false)}
            message={alertInfos.message}
            severity={alertInfos.severity}
          />
        </form>
      </div>
    </Container>
  );
};

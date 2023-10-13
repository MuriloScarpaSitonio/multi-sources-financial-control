import { useState } from "react";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { AuthenticationApi } from "../api";
import { AccessTokenStr, RefreshTokenStr } from "../consts";
import { FormFeedback } from "../components/FormFeedback";
import { setUserDataToLocalStorage } from "../helpers.js";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  form: {
    width: "100%", // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
}));

const schema = yup.object().shape({
  email: yup
    .string()
    .email("Insira um email válido")
    .required("Campo obrigatório"),
  password: yup.string().min(4).required("Campo obrigatório"),
});

export const Login = (props) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const classes = useStyles();
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
    let api = new AuthenticationApi();
    api
      .login(data)
      .then((response) => {
        localStorage.setItem(RefreshTokenStr, response.data.refresh);
        localStorage.setItem(AccessTokenStr, response.data.access);
        setAlertInfos({
          message: "Sucesso! Redirecionando...",
          severity: "success",
        });
        setUserDataToLocalStorage(response.data.user);
        if (response.data.user.subscription_status === "CANCELED") {
          props.history.push("/subscription");
        } else {
          props.history.push("/home");
        }
      })
      .catch((error) => {
        setAlertInfos({
          message: JSON.stringify(error.response.data),
          severity: "error",
        });
        reset({ password: "", email: data.email });
      })
      .finally(() => {
        setIsLoaded(true);
        setShowAlert(true);
      });
  };
  if (
    localStorage.getItem(AccessTokenStr) &&
    localStorage.getItem(RefreshTokenStr)
  ) {
    props.history.push("/home");
  }
  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h5">
          Login
        </Typography>
        <form className={classes.form}>
          <Controller
            name="email"
            id="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                variant="outlined"
                margin="normal"
                required
                fullWidth
                label="E-mail"
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />
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
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
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
              "Login"
            ) : (
              <CircularProgress size={24} style={{ color: "white" }} />
            )}
          </Button>
          <Grid container>
            <Grid item xs>
              <Link href="/forgot_password" variant="body2">
                Esqueceu a senha?
              </Link>
            </Grid>
            <Grid item>
              <Link href="/signup" variant="body2">
                Ainda não tem conta? Cadastre-se!
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

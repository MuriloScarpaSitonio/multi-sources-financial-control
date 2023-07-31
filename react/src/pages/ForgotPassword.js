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
import { FormFeedback } from "../components/FormFeedback";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.secondary.main,
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
  email: yup.string().email().required(),
});

export const ForgotPassword = (props) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const classes = useStyles();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });

  const onSubmit = (data) => {
    setIsLoaded(false);
    new AuthenticationApi()
      .forgotPassword(data.email)
      .then(() => {
        setAlertInfos({
          message: "Sucesso! Redirecionando...",
          severity: "success",
        });
        props.history.push("/forgot_password/done");
      })
      .catch((error) => {
        setAlertInfos({
          message: JSON.stringify(error.response.data),
          severity: "error",
        });
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
          Esqueci minha senha
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
                autoFocus
                error={!!errors.email}
                helperText={
                  errors.email?.message ||
                  "Um link para definir uma nova senha será enviado para este email, se ele existir no nosso banco de dados"
                }
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
              "Enviar"
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

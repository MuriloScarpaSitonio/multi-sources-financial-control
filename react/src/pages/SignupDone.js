import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { makeStyles } from "@mui/styles";
import Container from "@mui/material/Container";

const useStyles = makeStyles((theme) => ({
  paper: {
    // marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

export const SignupDone = () => {
  const classes = useStyles();
  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h4">
          Obrigado pelo cadastro!
        </Typography>
        <Typography component="h1" variant="h6">
          Você receberá um e-mail em breve com instruções para ativar sua conta.
        </Typography>

        <Link href="/" variant="body2">
          Retornar a página de login
        </Link>
      </div>
    </Container>
  );
};

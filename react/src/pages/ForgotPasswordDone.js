import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

export const ForgotPasswordDone = () => {
  const classes = useStyles();
  return (
    <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h6">
          Você receberá um e-mail em breve com instruções para definir uma nova
          senha.
        </Typography>
        <Link href="/" variant="body2">
          Retornar a página de login
        </Link>
      </div>
    </Container>
  );
};

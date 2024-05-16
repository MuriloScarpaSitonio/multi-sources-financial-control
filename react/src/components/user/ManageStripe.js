import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { SubscriptionApi } from "../../api";

export function ManageStripe() {
  const [isLoaded, setIsLoaded] = useState(true);

  const createPortalSession = () => {
    setIsLoaded(false);
    new SubscriptionApi()
      .createPortalSession()
      .then((response) => window.location.replace(response.data.url));
    // .catch((error) => {
    //   console.log(error);
    // })
  };
  return (
    <Grid container justifyContent="center">
      <Grid item>
        <Grid container justifyContent="center" style={{ maxWidth: "1000px" }}>
          <Grid item>
            <Typography align="center">
              Seus dados de cobraça e fatura são salvos num parceiro - o Stripe,
              a maior plataforma de processamento de pagamentos do mundo. Clique
              no botão abaixo para atualizá-los ou para alterar seu plano.
            </Typography>
          </Grid>
        </Grid>
        <Grid container justifyContent="center">
          <Grid item>
            <Button
              variant={isLoaded && "contained"}
              color="primary"
              onClick={createPortalSession}
              size="large"
            >
              {!isLoaded ? (
                <CircularProgress size={24} />
              ) : (
                "Alterar plano ou dados de cobrança"
              )}
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}

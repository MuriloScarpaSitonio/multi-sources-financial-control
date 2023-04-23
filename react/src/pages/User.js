import Typography from "@material-ui/core/Typography";

import { DividerWithText } from "../components/DividerWithText";
import { IntegrationsConfiguration } from "../components/user/IntegrationsConfiguration";

export default function User() {
  return (
    <>
      <Typography component="h1" variant="h5">
        Configurações de {localStorage.getItem("user_username")}
      </Typography>
      <DividerWithText children="Integrações" container />
      <IntegrationsConfiguration userId={localStorage.getItem("user_id")} />
    </>
  );
}

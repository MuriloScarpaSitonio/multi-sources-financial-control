import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { UserProfileForm } from "../../forms/UserProfileForm";
import { ChangePasswordForm } from "../../forms/ChangePasswordForm";

export function UserData({ initialData }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Typography variant="h6" gutterBottom>
          Meus dados
        </Typography>
        <UserProfileForm initialData={initialData} />
      </Grid>
      <Grid item xs={6}>
        <Typography variant="h6" gutterBottom>
          Alterar senha
        </Typography>
        <ChangePasswordForm userId={initialData.userId} />
      </Grid>
    </Grid>
  );
}

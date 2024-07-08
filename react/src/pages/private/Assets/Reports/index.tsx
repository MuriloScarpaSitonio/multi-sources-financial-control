import Grid from "@mui/material/Grid";

import RoiReports from "./RoiReports";
import TotalInvestedReports from "./TotalInvestedReports";

export default function Reports() {
  return (
    <Grid container spacing={4} maxWidth="xl">
      <Grid item xs={6}>
        <RoiReports />
      </Grid>
      <Grid item xs={6}>
        <TotalInvestedReports />
      </Grid>
    </Grid>
  );
}

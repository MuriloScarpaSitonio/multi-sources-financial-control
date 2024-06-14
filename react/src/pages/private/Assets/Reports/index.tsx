import Grid from "@mui/material/Grid";

import RoiReports from "./RoiReports";
import TotalInvestedReports from "./TotalInvestedReports";

export default function Reports() {
  return (
    <Grid container spacing={4} sx={{ width: "100%", mt: 2 }}>
      <Grid item xs={6}>
        <RoiReports />
      </Grid>
      <Grid item xs={6}>
        <TotalInvestedReports />
      </Grid>
    </Grid>
  );
}

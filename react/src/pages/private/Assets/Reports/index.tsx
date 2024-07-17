import Grid from "@mui/material/Grid";

import AssetAggregationReports from "./AssetAggregationReports";

export default function Reports() {
  return (
    <Grid container spacing={4} maxWidth="xl">
      <Grid item xs={12}>
        <AssetAggregationReports />
      </Grid>
    </Grid>
  );
}

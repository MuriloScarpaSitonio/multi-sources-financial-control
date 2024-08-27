import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";

import Indicators from "./Indicators";
import Reports from "./Reports";
import Table from "./Table";

const Assets = () => (
  <Stack spacing={2}>
    <Grid container spacing={4}>
      <Grid item xs={5}>
        <Indicators />
      </Grid>
      <Grid item xs={7}>
        <Reports />
      </Grid>
    </Grid>
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Table />
      </Grid>
    </Grid>
  </Stack>
);

export default Assets;

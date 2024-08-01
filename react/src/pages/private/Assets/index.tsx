import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import Indicators from "./Indicators";
import Reports from "./Reports";
import Table from "./Table";

const Assets = () => (
  <Stack spacing={2}>
    <Indicators />
    <Reports />
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Table />
      </Grid>
    </Grid>
  </Stack>
);

export default Assets;

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import Indicators from "./Indicators";
import IncomesIndicator from "./Indicators/IncomesIndicator";
import Reports from "./Reports";
import Table from "./Table";

const Assets = () => (
  <Stack spacing={2}>
    <Indicators extra={<IncomesIndicator />} />
    <Reports />
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Table />
      </Grid>
    </Grid>
  </Stack>
);

export default Assets;

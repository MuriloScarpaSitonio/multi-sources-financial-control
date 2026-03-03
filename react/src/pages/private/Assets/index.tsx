import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";

import useURLFilters from "../../../hooks/useURLFilters";
import { assetsFilterSchema, defaultAssetsFilters } from "./filterConfig";
import Indicators from "./Indicators";
import IncomesIndicator from "./Indicators/IncomesIndicator";
import Reports from "./Reports";
import Table from "./Table";
import type { Filters } from "./Table/types";

const Assets = () => {
  const { filters, setFilters } = useURLFilters<Filters>({
    schema: assetsFilterSchema,
    defaults: defaultAssetsFilters as Filters,
  });

  return (
    <Stack spacing={2}>
      <Indicators extra={<IncomesIndicator />} />
      <Reports />
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <Table externalFilters={{ filters, setFilters }} />
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Assets;

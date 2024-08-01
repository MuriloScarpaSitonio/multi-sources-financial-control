import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Grid";

import AssetAggregationReports from "./AssetAggregationReports";
import AssetTotalInvestedSnapshots from "./AssetTotalInvestedSnapshots";
import { Text } from "../../../../design-system";

export default function Reports() {
  return (
    <Grid container spacing={4}>
      <Grid item xs={7}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Meus investimentos</Text>
          <AssetAggregationReports />
        </Stack>
      </Grid>
      <Grid item xs={5}>
        <Stack spacing={4}>
          {/* no idea why spacing does not work */}
          <Text extraStyle={{ marginBottom: 2 }}>Evolução Patrimonial</Text>
          <AssetTotalInvestedSnapshots />
        </Stack>
      </Grid>
    </Grid>
  );
}

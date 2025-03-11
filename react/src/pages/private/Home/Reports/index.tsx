import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Grid";

import { Text } from "../../../../design-system";
import PatrimonyHistory from "./PatrimonyHistory";
import ExpensesAndRevenuesHistory from "./ExpensesAndRevenuesHistory";

const Reports = () => (
  <Grid container spacing={4}>
    <Grid item xs={6}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>Evolução Patrimonial</Text>
        <PatrimonyHistory />
      </Stack>
    </Grid>
    <Grid item xs={6}>
      <Stack spacing={4}>
        {/* no idea why spacing does not work */}
        <Text extraStyle={{ marginBottom: 2 }}>Despesas x Receitas</Text>
        <ExpensesAndRevenuesHistory />
      </Stack>
    </Grid>
  </Grid>
);

export default Reports;

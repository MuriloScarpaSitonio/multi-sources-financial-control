import Stack from "@mui/material/Stack";

import Indicators from "./Indicators";
import Reports from "./Reports";
import { EvolutionSection, FinancialHealthSummary } from "./FinancialHealthSummary";
import { Text } from "../../../design-system";

const Home = () => (
  <Stack spacing={4}>
    <Indicators />
    <Reports />
    <EvolutionSection />
    <Stack spacing={2} sx={{ pb: 4 }}>
      <Text>Saúde Financeira</Text>
      <FinancialHealthSummary />
    </Stack>
  </Stack>
);

export default Home;

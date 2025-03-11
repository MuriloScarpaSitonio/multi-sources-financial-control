import Stack from "@mui/material/Stack";

import Indicators from "./Indicators";
import Reports from "./Reports";

const Home = () => (
  <Stack spacing={2}>
    <Indicators />
    <Reports />
  </Stack>
);

export default Home;

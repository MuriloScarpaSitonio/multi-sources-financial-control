import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export type FireCalculationState = {
  isCalculating: boolean;
  error: string | null;
};

const FireResultsSkeleton = () => (
  <Stack
    data-testid="fire-results-skeleton"
    gap={2}
    aria-label="Calculando simulação"
  >
    <Skeleton variant="rounded" height={72} />
    <Skeleton variant="rounded" height={156} />
    <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
      <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
      <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
      <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
    </Stack>
    <Skeleton variant="rounded" height={260} />
    <Skeleton variant="rounded" height={260} />
  </Stack>
);

export default FireResultsSkeleton;

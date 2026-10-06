import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
} from "../../../../design-system";
import type { OneOverNSimulationOutput } from "../../Home/oneOverNSimulation";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import FireResultsSkeleton from "../fire/FireResultsSkeleton";
import {
  withoutOneOverNHistoricalFallbacks,
  type OneOverNSnapshot,
} from "./oneOverNScenario";
import OneOverNResults from "./OneOverNResults";

const periodLabel = (snapshot: OneOverNSnapshot) => {
  const format = (month: string | undefined) =>
    month ? `${month.slice(5)}/${month.slice(0, 4)}` : "—";
  return `${format(snapshot.historyMonths[0])}–${format(snapshot.historyMonths.at(-1))}`;
};

export default function OneOverNComparisonPanel({
  snapshot,
  baseline,
}: {
  snapshot: OneOverNSnapshot;
  baseline: OneOverNSimulationOutput;
}) {
  const without = useMemo(() => {
    try {
      return withoutOneOverNHistoricalFallbacks(snapshot);
    } catch {
      return null;
    }
  }, [snapshot]);
  const worker = useFireSimulationWorker(without?.request ?? null);
  const [visible, setVisible] = useState({ p10: true, p50: true, p90: true });
  const toggle = (key: keyof typeof visible, checked: boolean) =>
    setVisible((current) => ({ ...current, [key]: checked }));
  const renderResult = (
    source: OneOverNSnapshot,
    output: OneOverNSimulationOutput,
  ) => (
    <OneOverNResults
      snapshot={source}
      output={output}
      comparison
      scenarioVisibility={visible}
      onScenarioVisibilityChange={toggle}
    />
  );
  return (
    <Paper
      component="section"
      aria-label="Comparação de históricos"
      elevation={1}
      sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, minWidth: 0 }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {[snapshot, without].map((source, index) => (
          <Stack key={index} gap={2} sx={{ minWidth: 0 }}>
            <Stack gap={0.5}>
              <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
                {index === 0 ? "Com complemento" : "Sem complemento"}
              </Text>
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                Período histórico: {source ? periodLabel(source) : "—"}
              </Text>
            </Stack>
            {index === 0 ? (
              renderResult(snapshot, baseline)
            ) : !source || worker.error ? (
              <Alert severity="error">
                Não foi possível calcular sem complemento. Feche a comparação e
                tente novamente. O resultado com complemento foi preservado.
              </Alert>
            ) : worker.isCalculating || !worker.result ? (
              <Box aria-label="Calculando sem complemento">
                <FireResultsSkeleton />
              </Box>
            ) : (
              renderResult(source, worker.result.output)
            )}
          </Stack>
        ))}
      </Box>
    </Paper>
  );
}

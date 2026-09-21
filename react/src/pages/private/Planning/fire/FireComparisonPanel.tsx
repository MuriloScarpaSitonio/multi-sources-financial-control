import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";
import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
} from "../../../../design-system";
import { useHideValues } from "../../../../hooks/useHideValues";
import FireAccumulationChart from "../../Home/FireAccumulationChart";
import FireSimulationResults from "../../Home/FireSimulationResults";
import FireAccumulationExtensionNotice from "../../Home/FireAccumulationExtensionNotice";
import type { FireSimulationResult } from "../../Home/fireSimulation";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import { eligiblePeriod } from "../../Home/firePortfolio";
import {
  withoutHistoricalFallbacks,
  type FireStudioSnapshot,
} from "./fireStudioScenario";

type Scenario = "otimista" | "mediana" | "pessimista";
type ResultProps = ComponentProps<typeof FireSimulationResults>;

// Presentation only: use each worker's calculated target and retirement results.
const resultProps = (
  snapshot: FireStudioSnapshot,
  result: FireSimulationResult,
) => {
  const output = result.output;
  const state =
    result.kind === "constant_dollar"
      ? result.output
      : result.output.solverState;
  const bootstrap =
    result.kind === "constant_dollar"
      ? result.output.bootstrap
      : result.output.lifestyleBootstrap;
  const target = state.fireTarget;
  return {
    patrimony:
      output.extendedAccumulation?.medianStartingBalance ??
      snapshot.effectivePatrimony,
    currentPatrimony: snapshot.patrimonyTotal,
    monthlyExpenses: snapshot.monthlyExpenses,
    annualExpenses: snapshot.monthlyExpenses * 12,
    withdrawalRate: snapshot.withdrawalRate,
    targetYears: snapshot.targetYears,
    safeRate: state.safeRate,
    fireTarget: target,
    fireProgress: target > 0 ? (snapshot.effectivePatrimony / target) * 100 : 0,
    retirementProgress:
      target > 0 ? (snapshot.patrimonyTotal / target) * 100 : 0,
    bootstrap,
    rateBootstrap: state.rateBootstrap,
    accumulation: state.accumulation,
    currentAge: snapshot.currentAge,
    yearsToRetirement:
      output.extendedAccumulation?.medianYearsToRetirement ??
      (result.kind === "age_in_bonds"
        ? result.output.solverState.anchorAge - (snapshot.currentAge ?? 0)
        : undefined),
    trialCount: output.extendedAccumulation?.retirementTrialCount,
  } satisfies Partial<ResultProps>;
};

const periodLabel = (snapshot: FireStudioSnapshot) => {
  const period = eligiblePeriod(snapshot.portfolio);
  const format = (month: string | null) =>
    month ? `${month.slice(5)}/${month.slice(0, 4)}` : "—";
  return `${format(period.first)}–${format(period.last)}`;
};

const FireComparisonPanel = ({
  snapshot,
  baseline,
}: {
  snapshot: FireStudioSnapshot;
  baseline: FireSimulationResult;
}) => {
  const without = useMemo(
    () => withoutHistoricalFallbacks(snapshot),
    [snapshot],
  );
  const { result, isCalculating, error } = useFireSimulationWorker(
    without.request,
  );
  const { hideValues } = useHideValues();
  const stacked = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [visible, setVisible] = useState<Scenario[]>([
    "otimista",
    "mediana",
    "pessimista",
  ]);
  const toggle = (scenario: Scenario, checked: boolean) =>
    setVisible((current) =>
      checked
        ? [...current, scenario]
        : current.length > 1
          ? current.filter((value) => value !== scenario)
          : current,
    );
  const renderResult = (
    value: FireSimulationResult,
    source: FireStudioSnapshot,
    column: 1 | 2,
  ) => {
    const extension = value.output.extendedAccumulation;
    if (extension?.retirementStartRate === 0) return null;
    const props = resultProps(source, value);
    const progress = source.showAgeInBonds
      ? props.fireProgress
      : props.retirementProgress;
    return (
      <>
        <FireSimulationResults
          {...props}
          comparisonColumn={column}
          comparisonStacked={stacked}
          hideValues={hideValues}
          showOtimista={visible.includes("otimista")}
          showMediana={visible.includes("mediana")}
          showPessimista={visible.includes("pessimista")}
          onScenarioVisibilityChange={toggle}
        />
        {progress < 100 && props.accumulation.gapBands.length > 1 && (
          <Stack
            gap={1.5}
            sx={{
              minWidth: 0,
              gridColumn: stacked ? 1 : column,
              gridRow: stacked ? 20 + column : 11,
            }}
          >
            <FireAccumulationChart
              accumulation={props.accumulation}
              currentAge={source.currentAge}
              hideValues={hideValues}
              showOtimista={visible.includes("otimista")}
              showMediana={visible.includes("mediana")}
              showPessimista={visible.includes("pessimista")}
            />
          </Stack>
        )}
      </>
    );
  };
  return (
    <Paper
      component="section"
      aria-label="Comparação de históricos"
      elevation={1}
      sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}
    >
      <Stack gap={2}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 2,
          }}
        >
          {(["Com complemento", "Sem complemento"] as const).map(
            (label, index) => (
              <Stack key={label} gap={0.5}>
                <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
                  {label}
                </Text>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  Período histórico:{" "}
                  {periodLabel(index === 0 ? snapshot : without)}
                </Text>
              </Stack>
            ),
          )}
        </Box>
        {snapshot.showAgeInBonds && (
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            O período de acumulação pode ser diferente do período usado nas
            retiradas, conforme a alocação por idade.
          </Text>
        )}
        {baseline.output.extendedAccumulation && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <FireAccumulationExtensionNotice
              result={baseline.output.extendedAccumulation}
              hideValues={hideValues}
              horizon={snapshot.targetYears}
            />
            {result?.output.extendedAccumulation && !isCalculating && (
              <FireAccumulationExtensionNotice
                result={result.output.extendedAccumulation}
                hideValues={hideValues}
                horizon={snapshot.targetYears}
              />
            )}
          </Box>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: stacked
              ? "minmax(0, 1fr)"
              : "repeat(2, minmax(0, 1fr))",
            gap: 1.5,
            alignItems: "stretch",
          }}
        >
          {renderResult(baseline, snapshot, 1)}
          {isCalculating || (!result && !error) ? (
            <Box
              aria-label="Calculando sem complemento"
              sx={{ display: "contents" }}
            >
              {Array.from({ length: 11 }, (_, index) => (
                <Skeleton
                  key={index}
                  variant="rounded"
                  height={
                    index === 8 || index === 10 ? 300 : index < 2 ? 64 : 82
                  }
                  sx={{
                    gridColumn: stacked ? 1 : 2,
                    gridRow: stacked ? (index + 1) * 2 : index + 1,
                  }}
                />
              ))}
            </Box>
          ) : error ? (
            <Alert
              severity="error"
              sx={{
                gridColumn: stacked ? 1 : 2,
                gridRow: stacked ? 2 : "1 / span 10",
              }}
            >
              Não foi possível calcular sem complemento. Feche a comparação e
              tente novamente. O resultado com complemento foi preservado.
            </Alert>
          ) : (
            result && renderResult(result, without, 2)
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

export default FireComparisonPanel;

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import type { ReactNode } from "react";

import ConstantDollarAgeInBondsIndicator from "../../Home/ConstantDollarAgeInBondsIndicator";
import ConstantDollarIndicator from "../../Home/ConstantDollarIndicator";
import { eligiblePeriod } from "../../Home/firePortfolio";
import type { FireCalculationState } from "./FireResultsSkeleton";
import FireResultsSkeleton from "./FireResultsSkeleton";
import type { FireStudioSnapshot } from "./fireStudioScenario";

type Props = {
  snapshot: FireStudioSnapshot | null;
  dateOfBirth: string | null;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
  calculationState: FireCalculationState;
  onCalculationStateChange: (state: FireCalculationState) => void;
  onAdjustHistoricalSources: () => void;
};

const ResultsSurface = ({ children }: { children: ReactNode }) => (
  <Paper elevation={1} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
    <Stack gap={2}>{children}</Stack>
  </Paper>
);

const FireResultsPanel = ({
  snapshot,
  dateOfBirth,
  fixedIncomeTotal,
  variableIncomeTotal,
  calculationState,
  onCalculationStateChange,
  onAdjustHistoricalSources,
}: Props) => {
  if (snapshot === null) {
    return (
      <ResultsSurface>
        <FireResultsSkeleton />
      </ResultsSurface>
    );
  }

  if (snapshot.request === null) {
    return (
      <ResultsSurface>
        <Alert severity="info">
          Configure sua data de nascimento no perfil para calcular a estratégia
          Idade em Renda Fixa.
        </Alert>
      </ResultsSurface>
    );
  }

  const period = eligiblePeriod(snapshot.portfolio);
  const shortPeriod = period.count > 0 && period.count < 120;
  let indicator: ReactNode;
  if (snapshot.request.kind === "constant_dollar") {
    const input = snapshot.request.input;
    indicator = (
      <ConstantDollarIndicator
        patrimonyTotal={input.patrimonyTotal}
        avgExpenses={input.annualExpenses / 12}
        isLoading={false}
        withdrawalRate={input.withdrawalRate}
        onWithdrawalRateChange={() => undefined}
        targetYears={input.targetYears}
        onTargetYearsChange={() => undefined}
        portfolio={input.portfolio}
        samplingMethod={input.samplingMethod}
        monthlySavings={input.annualSavings / 12}
        defaultMonthlySavings={input.annualSavings / 12}
        dateOfBirth={dateOfBirth}
        simulatedPatrimony={input.simulatedPatrimony}
        simulatedExpenses={null}
        presentation="studio"
        simulationRequestOverride={snapshot.request}
        onCalculationStateChange={onCalculationStateChange}
      />
    );
  } else {
    const input = snapshot.request.input;
    indicator = (
      <ConstantDollarAgeInBondsIndicator
        patrimonyTotal={snapshot.patrimonyTotal}
        avgExpenses={input.annualExpenses / 12}
        isLoading={false}
        dateOfBirth={dateOfBirth}
        withdrawalRate={input.withdrawalRate}
        onWithdrawalRateChange={() => undefined}
        targetYears={input.targetYears}
        onTargetYearsChange={() => undefined}
        portfolio={input.portfolio}
        samplingMethod={input.samplingMethod}
        fixedIncomeTotal={fixedIncomeTotal}
        variableIncomeTotal={variableIncomeTotal}
        monthlySavings={input.annualSavings / 12}
        defaultMonthlySavings={input.annualSavings / 12}
        simulatedPatrimony={
          input.effectivePatrimony === snapshot.patrimonyTotal
            ? null
            : input.effectivePatrimony
        }
        simulatedExpenses={null}
        presentation="studio"
        simulationRequestOverride={snapshot.request}
        onCalculationStateChange={onCalculationStateChange}
      />
    );
  }

  return (
    <ResultsSurface>
      {!calculationState.isCalculating && shortPeriod && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={onAdjustHistoricalSources}
            >
              Ajustar
            </Button>
          }
        >
          O período histórico é curto; a simulação continua disponível, mas o
          resultado é menos robusto.
        </Alert>
      )}
      {indicator}
    </ResultsSurface>
  );
};

export default FireResultsPanel;

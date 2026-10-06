import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { formatCurrency } from "../utils";
import type { AccumulationResult, BootstrapResult } from "./fireBootstrap";
import {
  ChartTooltipBox,
  GoalProgressBar,
  PercentileTrajectoryChart,
  ScenarioTable,
  ScenarioToggles,
  SuccessVerdictCard,
  successToneColor,
} from "../Planning/shared/simulationResultParts";
import {
  buildFireScenarioRows,
  buildFireSummary,
  formatSimulationSuccessRate,
  type FireSuccessBand,
} from "./fireResultPresentation";

type Props = {
  comparisonColumn?: 1 | 2;
  comparisonStacked?: boolean;
  patrimony: number;
  currentPatrimony: number;
  monthlyExpenses: number;
  annualExpenses: number;
  withdrawalRate: number;
  targetYears: number;
  safeRate: number;
  fireTarget: number;
  fireProgress: number;
  retirementProgress: number;
  bootstrap: BootstrapResult;
  rateBootstrap: BootstrapResult;
  accumulation: AccumulationResult;
  currentAge: number | null;
  yearsToRetirement?: number | null;
  trialCount?: number;
  showOtimista: boolean;
  showMediana: boolean;
  showPessimista: boolean;
  onScenarioVisibilityChange: (
    scenario: "otimista" | "mediana" | "pessimista",
    checked: boolean,
  ) => void;
  hideValues: boolean;
};

const valueOrHidden = (hideValues: boolean, value: string) =>
  hideValues ? "***" : value;

type DrawdownPoint = {
  age: number;
  year: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  withdrawalP10: number | null;
  withdrawalP50: number | null;
  withdrawalP90: number | null;
};

const DrawdownTooltipContent = ({
  active,
  payload,
  hideValues,
  showOtimista,
  showMediana,
  showPessimista,
  xLabel = "Idade",
}: {
  active?: boolean;
  payload?: { payload: DrawdownPoint }[];
  hideValues?: boolean;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
  xLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmtBal = (v: number) => (hideValues ? "***" : formatCurrency(v));
  const fmtWd = (v: number | null) =>
    v === null ? "-" : hideValues ? "***" : `${formatCurrency(v / 12)}/mes`;
  return (
    <ChartTooltipBox>
      <p style={{ color: getColor(Colors.neutral300) }}>
        {xLabel}: {xLabel === "Idade" ? data.age : data.year}
      </p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista (p10): {fmtBal(data.balanceP10)} ·{" "}
          {fmtWd(data.withdrawalP10)}
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {fmtBal(data.balanceP50)} · {fmtWd(data.withdrawalP50)}
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p90): {fmtBal(data.balanceP90)} ·{" "}
          {fmtWd(data.withdrawalP90)}
        </p>
      )}
    </ChartTooltipBox>
  );
};

export const MetricBlock = ({
  label,
  value,
  sub,
  children,
  tone = "good",
  hideValues = false,
  position,
}: {
  position?: { gridColumn: number; gridRow: number };
  label: string;
  value: string;
  sub?: ReactNode;
  children?: ReactNode;
  tone?: FireSuccessBand;
  hideValues?: boolean;
}) => (
  <Stack
    gap={0.5}
    sx={{
      ...position,
      minWidth: 0,
      border: "1px solid",
      borderColor: getColor(Colors.neutral600),
      borderRadius: 1,
      px: 1.5,
      py: 1,
      backgroundColor: getColor(Colors.neutral900),
    }}
  >
    <Text
      size={FontSizes.EXTRA_SMALL}
      color={Colors.neutral400}
      extraStyle={{ lineHeight: 1.4 }}
    >
      {label}
    </Text>
    <Text
      size={FontSizes.SMALL}
      weight={FontWeights.SEMI_BOLD}
      extraStyle={{
        color: successToneColor(tone),
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {valueOrHidden(hideValues, value)}
    </Text>
    {sub && (
      <Text
        size={FontSizes.EXTRA_SMALL}
        color={Colors.neutral400}
        extraStyle={{ lineHeight: 1.4 }}
      >
        {sub}
      </Text>
    )}
    {children}
  </Stack>
);

const FireSimulationResults = ({
  comparisonColumn,
  comparisonStacked = false,
  patrimony,
  currentPatrimony,
  monthlyExpenses,
  annualExpenses,
  withdrawalRate,
  targetYears,
  safeRate,
  fireTarget,
  fireProgress,
  retirementProgress,
  bootstrap,
  rateBootstrap,
  accumulation,
  currentAge,
  yearsToRetirement,
  trialCount = 2000,
  showOtimista,
  showMediana,
  showPessimista,
  onScenarioVisibilityChange,
  hideValues,
}: Props) => {
  const summary = buildFireSummary({
    patrimony,
    annualExpenses,
    withdrawalRate,
    safeWithdrawalRate: safeRate,
    successRate: bootstrap.successRate,
    targetYears,
    trialCount,
  });
  const scenarioRows = buildFireScenarioRows(bootstrap.bands).filter((row) => {
    if (row.key === "p10") return showPessimista;
    if (row.key === "p50") return showMediana;
    return showOtimista;
  });
  const retirementDelay =
    yearsToRetirement === undefined
      ? accumulation.medianYearsToTarget
      : yearsToRetirement;
  const retirementAge =
    currentAge !== null && retirementDelay !== null
      ? currentAge + retirementDelay
      : null;
  const retirementChartData = bootstrap.bands.map((b, i) => {
    const wb = i === 0 ? null : bootstrap.withdrawalBands[i - 1];
    return {
      age: retirementAge !== null ? retirementAge + b.year : b.year,
      year: b.year,
      balanceP10: b.p10,
      balanceP50: b.p50,
      balanceP90: b.p90,
      withdrawalP10: wb?.p10 ?? null,
      withdrawalP50: wb?.p50 ?? null,
      withdrawalP90: wb?.p90 ?? null,
    };
  });
  const monthlyGapAbs = Math.abs(summary.monthlyGap);
  const gapTone = summary.monthlyGap >= 0 ? "good" : "bad";
  const gapLabel =
    summary.monthlyGap >= 0
      ? `Sobra ${formatCurrency(monthlyGapAbs)}/mes`
      : `Falta ${formatCurrency(monthlyGapAbs)}/mes`;
  const visible = {
    p10: showPessimista,
    p50: showMediana,
    p90: showOtimista,
  };
  const scenarioControls = (
    <ScenarioToggles
      visible={visible}
      onChange={(key, checked) =>
        onScenarioVisibilityChange(
          key === "p90" ? "otimista" : key === "p50" ? "mediana" : "pessimista",
          checked,
        )
      }
    />
  );

  const position = (row: number) =>
    comparisonColumn
      ? {
          gridColumn: comparisonStacked ? 1 : comparisonColumn,
          gridRow: comparisonStacked ? (row - 1) * 2 + comparisonColumn : row,
        }
      : undefined;
  return (
    <Stack gap={2} sx={comparisonColumn ? { display: "contents" } : undefined}>
      <Stack gap={0.75} sx={position(1)}>
        <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
          Resultado da simulação
        </Text>
      </Stack>

      <SuccessVerdictCard
        band={summary.band}
        verdict={summary.verdict}
        rate={
          hideValues
            ? "***"
            : formatSimulationSuccessRate(bootstrap.successRate)
        }
        sx={position(2)}
      >
        Chance historica de sustentar {formatCurrency(monthlyExpenses)}/mes por{" "}
        {targetYears} anos se a aposentadoria comecasse hoje:{" "}
        {summary.failedLabel}.
      </SuccessVerdictCard>

      <Stack
        gap={1.25}
        sx={comparisonColumn ? { display: "contents" } : undefined}
      >
        <Box
          sx={{
            display: comparisonColumn ? "contents" : "grid",
            gap: 1.25,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          <MetricBlock
            position={position(3)}
            label="Patrimonio atual"
            value={formatCurrency(currentPatrimony)}
            hideValues={hideValues}
          >
            <GoalProgressBar
              progress={retirementProgress}
              goalLabel="meta FIRE"
              hideValues={hideValues}
              tooltip={`Mostra quanto da meta FIRE já é coberto pelo seu patrimônio atual. O cálculo usa o patrimônio da carteira e a meta calculada para este cenário: ${valueOrHidden(hideValues, formatCurrency(fireTarget))}.`}
            />
          </MetricBlock>
          <MetricBlock
            position={position(4)}
            label="Meta FIRE"
            value={formatCurrency(fireTarget)}
            hideValues={hideValues}
          >
            <Text noWrap size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              {hideValues
                ? "***"
                : fireProgress > 100
                  ? `${(fireProgress - 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% acima da meta`
                  : fireProgress === 100
                    ? "Meta atingida"
                    : `${(100 - fireProgress).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% abaixo da meta`}
            </Text>
          </MetricBlock>
          <MetricBlock
            position={position(5)}
            label="Multiplo atual"
            value={
              summary.expenseMultiple === null
                ? "-"
                : `${summary.expenseMultiple.toFixed(1)}x`
            }
            sub="patrimonio / despesa anual"
            hideValues={hideValues}
          />
        </Box>

        <Box
          sx={{
            display: comparisonColumn ? "contents" : "grid",
            gap: 1.25,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          <MetricBlock
            position={position(6)}
            label="Gasto seguro estimado"
            value={`${formatCurrency(summary.safeMonthlySpend)}/mes`}
            sub={`${safeRate.toFixed(2)}% a.a. para 90% de sucesso`}
            hideValues={hideValues}
          />
          <MetricBlock
            position={position(7)}
            label={`Retirada a ${withdrawalRate}%`}
            value={`${formatCurrency(summary.chosenMonthlyWithdrawal)}/mes`}
            sub={`sucesso historico da taxa: ${(rateBootstrap.successRate * 100).toFixed(0)}%`}
            tone={rateBootstrap.successRate >= 0.85 ? "good" : "bad"}
            hideValues={hideValues}
          />
          <MetricBlock
            position={position(8)}
            label="Folga do gasto seguro"
            value={gapLabel}
            tone={gapTone}
            hideValues={hideValues}
          />
        </Box>
      </Stack>

      {scenarioRows.length > 0 && (
        <Stack gap={1.75} sx={{ ...position(9), minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
          >
            <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
              O que pode acontecer com seu patrimonio?
            </Text>
            {scenarioControls}
          </Stack>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Patrimonio final se a aposentadoria comecasse com o patrimonio usado
            no cenario e retirasse {formatCurrency(monthlyExpenses)}/mes por{" "}
            {targetYears} anos, em valores de hoje.
          </Text>
          <ScenarioTable>
            <thead>
              <tr>
                <th>Cenario</th>
                <th>Patrimonio final</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row) => (
                <tr key={row.key}>
                  <td
                    style={{
                      color: successToneColor(row.tone),
                      fontWeight: 700,
                    }}
                  >
                    {row.label}
                  </td>
                  <td>
                    {valueOrHidden(hideValues, formatCurrency(row.value))}
                  </td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </ScenarioTable>
          <PercentileTrajectoryChart
            expandable
            fullscreenControls={scenarioControls}
            subtitle={
              <>
                Sucesso em {targetYears}a:{" "}
                <strong>{(bootstrap.successRate * 100).toFixed(0)}%</strong>
                {" · "}
                Depleção mediana:{" "}
                <strong>
                  {bootstrap.medianDepletionYear !== null
                    ? `${bootstrap.medianDepletionYear} anos`
                    : "nunca"}
                </strong>
                {" · "}
                Depleção pessimista (p10):{" "}
                <strong>
                  {bootstrap.p10DepletionYear !== null
                    ? `${bootstrap.p10DepletionYear} anos`
                    : "nunca"}
                </strong>
              </>
            }
            data={retirementChartData}
            xKey={retirementAge !== null ? "age" : "year"}
            dataKeys={{
              p10: "balanceP10",
              p50: "balanceP50",
              p90: "balanceP90",
            }}
            visible={visible}
            hideValues={hideValues}
            tooltip={
              <DrawdownTooltipContent
                hideValues={hideValues}
                showOtimista={showOtimista}
                showMediana={showMediana}
                showPessimista={showPessimista}
                xLabel={retirementAge !== null ? "Idade" : "Ano"}
              />
            }
          />
        </Stack>
      )}

      <Text
        size={FontSizes.EXTRA_SMALL}
        color={Colors.neutral400}
        extraStyle={position(10)}
      >
        Dados mensais reais alinhados pelo período histórico resultante.
        Resultados são históricos/simulados, não promessa de retorno.
      </Text>
    </Stack>
  );
};

export default FireSimulationResults;

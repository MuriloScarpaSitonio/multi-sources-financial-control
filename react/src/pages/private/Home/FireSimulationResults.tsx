import type { ReactNode } from "react";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  buildFireScenarioRows,
  buildFireSummary,
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

const toneColor = (tone: FireSuccessBand) => {
  if (tone === "good") return getColor(Colors.brand);
  if (tone === "warn") return "#f59e0b";
  return getColor(Colors.danger200);
};

const valueOrHidden = (hideValues: boolean, value: string) =>
  hideValues ? "***" : value;

const numberTickFormatter = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

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
    <Stack
      spacing={0.5}
      sx={{
        border: "1px solid",
        p: 1,
        borderColor: getColor(Colors.brand400),
        backgroundColor: getColor(Colors.neutral600),
      }}
    >
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
    </Stack>
  );
};

const MetricBlock = ({
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
        color: toneColor(tone),
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
  const onlyOneScenario =
    [showOtimista, showMediana, showPessimista].filter(Boolean).length === 1;

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

      <Stack
        alignItems="center"
        gap={0.75}
        sx={{
          border: "1px solid",
          borderColor: getColor(Colors.neutral600),
          borderRadius: 1,
          py: 2,
          px: 2,
          backgroundColor: getColor(Colors.neutral900),
          textAlign: "center",
          ...position(2),
        }}
      >
        <Text
          size={FontSizes.SMALL}
          weight={FontWeights.SEMI_BOLD}
          extraStyle={{ color: toneColor(summary.band) }}
        >
          {summary.verdict}
        </Text>
        <Text
          size={FontSizes.SEMI_LARGE}
          weight={FontWeights.BOLD}
          extraStyle={{ color: toneColor(summary.band), lineHeight: 1 }}
        >
          {hideValues ? "***" : `${(bootstrap.successRate * 100).toFixed(0)}%`}
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Chance historica de sustentar {formatCurrency(monthlyExpenses)}/mes
          por {targetYears} anos se a aposentadoria comecasse hoje:{" "}
          {summary.failedLabel}.
        </Text>
      </Stack>

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
            <Tooltip
              arrow
              describeChild
              title={`Mostra quanto da meta FIRE já é coberto pelo seu patrimônio atual. O cálculo usa o patrimônio da carteira e a meta calculada para este cenário: ${valueOrHidden(hideValues, formatCurrency(fireTarget))}.`}
            >
              <Box tabIndex={0} sx={{ position: "relative", mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, retirementProgress))}
                  aria-label="Progresso do patrimônio atual até a meta FIRE"
                  aria-valuetext={`${retirementProgress.toFixed(0)}% da meta FIRE`}
                  sx={{
                    height: 14,
                    borderRadius: "4px",
                    backgroundColor: getColor(Colors.neutral600),
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: getColor(
                        retirementProgress >= 100
                          ? Colors.brand
                          : Colors.danger200,
                      ),
                      borderRadius: "4px",
                    },
                  }}
                />
                <Text
                  aria-hidden
                  style={{ fontSize: 14 }}
                  size={FontSizes.EXTRA_SMALL}
                  weight={FontWeights.SEMI_BOLD}
                  color={Colors.neutral0}
                  extraStyle={{
                    position: "absolute",
                    top: "50%",
                    right: 6,
                    transform: "translateY(-50%)",
                    lineHeight: 1,
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  {retirementProgress.toFixed(0)}%
                </Text>
              </Box>
            </Tooltip>
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
            <Stack direction="row" flexWrap="wrap">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showOtimista}
                    onChange={(_, checked) =>
                      onScenarioVisibilityChange("otimista", checked)
                    }
                    disabled={onlyOneScenario && showOtimista}
                  />
                }
                label="Otimista"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMediana}
                    onChange={(_, checked) =>
                      onScenarioVisibilityChange("mediana", checked)
                    }
                    disabled={onlyOneScenario && showMediana}
                  />
                }
                label="Mediana"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPessimista}
                    onChange={(_, checked) =>
                      onScenarioVisibilityChange("pessimista", checked)
                    }
                    disabled={onlyOneScenario && showPessimista}
                  />
                }
                label="Pessimista"
              />
            </Stack>
          </Stack>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Patrimonio final se a aposentadoria comecasse com o patrimonio usado
            no cenario e retirasse {formatCurrency(monthlyExpenses)}/mes por{" "}
            {targetYears} anos, em valores de hoje.
          </Text>
          <Box
            component="table"
            sx={{
              width: "100%",
              borderCollapse: "collapse",
              "& th, & td": {
                borderBottom: `1px solid ${getColor(Colors.neutral600)}`,
                py: 1,
                px: 1,
                textAlign: "left",
                fontSize: 12,
              },
              "& th": {
                color: getColor(Colors.neutral300),
                fontWeight: 700,
              },
              "& td": {
                color: getColor(Colors.neutral200),
              },
            }}
          >
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
                  <td style={{ color: toneColor(row.tone), fontWeight: 700 }}>
                    {row.label}
                  </td>
                  <td>
                    {valueOrHidden(hideValues, formatCurrency(row.value))}
                  </td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </Box>
          <Stack gap={0.5} sx={{ mt: 1 }}>
            <Text
              size={FontSizes.SMALL}
              weight={FontWeights.SEMI_BOLD}
              color={Colors.neutral200}
            >
              Aposentadoria · trajetória do patrimônio no cenário atual
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
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
            </Text>
          </Stack>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={retirementChartData}
              margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey={retirementAge !== null ? "age" : "year"}
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                stroke={getColor(Colors.brand400)}
                tickLine={false}
                axisLine={false}
                tickFormatter={numberTickFormatter}
                tickCount={hideValues ? 0 : undefined}
              />
              <RechartsTooltip
                cursor={false}
                content={
                  <DrawdownTooltipContent
                    hideValues={hideValues}
                    showOtimista={showOtimista}
                    showMediana={showMediana}
                    showPessimista={showPessimista}
                    xLabel={retirementAge !== null ? "Idade" : "Ano"}
                  />
                }
              />
              {showPessimista && (
                <Line
                  type="monotone"
                  dataKey="balanceP10"
                  stroke={getColor(Colors.danger200)}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="p10 (pessimista)"
                />
              )}
              {showMediana && (
                <Line
                  type="monotone"
                  dataKey="balanceP50"
                  stroke={getColor(Colors.brand200)}
                  strokeWidth={2}
                  dot={false}
                  name="Mediana"
                />
              )}
              {showOtimista && (
                <Line
                  type="monotone"
                  dataKey="balanceP90"
                  stroke={getColor(Colors.brand)}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="p90 (otimista)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
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

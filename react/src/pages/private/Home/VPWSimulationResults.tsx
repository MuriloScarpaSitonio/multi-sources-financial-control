import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";

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
import type { FireSuccessBand } from "./fireResultPresentation";

export type VPWProjectionPoint = {
  age: number;
  withdrawalP10: number;
  withdrawalP50: number;
  withdrawalP90: number;
  balanceP10: number;
  balanceP50: number;
  balanceP90: number;
  expenses: number;
};

type Props = {
  patrimony: number;
  monthlyExpenses: number;
  monthlySavings: number;
  monthlyWithdrawal: number;
  vpwRate: number;
  coverage: number;
  targetPatrimony: number;
  yearsRemaining: number;
  targetAge: number;
  allocationLabel: string;
  retirementTimingLabel?: string;
  projection: VPWProjectionPoint[];
  showOtimista: boolean;
  showMediana: boolean;
  showPessimista: boolean;
  onScenarioVisibilityChange: (
    scenario: "otimista" | "mediana" | "pessimista",
    checked: boolean,
  ) => void;
  hideValues: boolean;
};

type VPWIncomeRow = {
  key: "p10" | "p50" | "p90";
  label: string;
  value: number;
  meaning: string;
  tone: FireSuccessBand;
};

const toneColor = (tone: FireSuccessBand) => {
  if (tone === "good") return getColor(Colors.brand);
  if (tone === "warn") return "#f59e0b";
  return getColor(Colors.danger200);
};

const valueOrHidden = (hideValues: boolean, value: string) =>
  hideValues ? "***" : value;

const numberTickFormatter = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const getCoverageTone = (coverage: number): FireSuccessBand => {
  if (coverage >= 100) return "good";
  if (coverage >= 80) return "warn";
  return "bad";
};

const buildVPWIncomeRows = (
  projection: readonly VPWProjectionPoint[],
): VPWIncomeRow[] => {
  const incomePoints = projection.filter(
    (point) =>
      point.withdrawalP10 > 0 ||
      point.withdrawalP50 > 0 ||
      point.withdrawalP90 > 0,
  );
  if (incomePoints.length === 0) return [];

  const minOf = (key: "withdrawalP10" | "withdrawalP50" | "withdrawalP90") =>
    Math.min(...incomePoints.map((point) => point[key]));

  return [
    {
      key: "p10",
      label: "Pessimista",
      value: minOf("withdrawalP10"),
      meaning: "Menor valor da linha p10 durante a aposentadoria.",
      tone: "bad",
    },
    {
      key: "p50",
      label: "Mediano",
      value: minOf("withdrawalP50"),
      meaning: "Menor valor da linha mediana durante a aposentadoria.",
      tone: "warn",
    },
    {
      key: "p90",
      label: "Otimista",
      value: minOf("withdrawalP90"),
      meaning: "Menor valor da linha p90 durante a aposentadoria.",
      tone: "good",
    },
  ];
};

const MetricBlock = ({
  label,
  value,
  sub,
  tone = "good",
  hideValues = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: FireSuccessBand;
  hideValues?: boolean;
}) => (
  <Stack
    gap={0.5}
    sx={{
      minWidth: 160,
      flex: "1 1 160px",
      border: "1px solid",
      borderColor: getColor(Colors.neutral600),
      borderRadius: 1,
      px: 1.5,
      py: 1.25,
      backgroundColor: getColor(Colors.neutral900),
    }}
  >
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      {label}
    </Text>
    <Text
      size={FontSizes.SEMI_REGULAR}
      weight={FontWeights.SEMI_BOLD}
      extraStyle={{ color: toneColor(tone), lineHeight: 1.2 }}
    >
      {valueOrHidden(hideValues, value)}
    </Text>
    {sub && (
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        {sub}
      </Text>
    )}
  </Stack>
);

const VPWTooltipContent = ({
  active,
  payload,
  hideValues,
  showOtimista,
  showMediana,
  showPessimista,
}: {
  active?: boolean;
  payload?: { payload: VPWProjectionPoint }[];
  hideValues?: boolean;
  showOtimista?: boolean;
  showMediana?: boolean;
  showPessimista?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const fmt = (v: number) => (hideValues ? "***" : formatCurrency(v));
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
      <p style={{ color: getColor(Colors.neutral300) }}>Idade: {data.age}</p>
      {showPessimista && (
        <p style={{ color: getColor(Colors.danger200) }}>
          Pessimista (p10): {fmt(data.balanceP10)} ·{" "}
          {fmt(data.withdrawalP10)}/mes
        </p>
      )}
      {showMediana && (
        <p style={{ color: getColor(Colors.brand200) }}>
          Mediana (p50): {fmt(data.balanceP50)} ·{" "}
          {fmt(data.withdrawalP50)}/mes
        </p>
      )}
      {showOtimista && (
        <p style={{ color: getColor(Colors.brand) }}>
          Otimista (p90): {fmt(data.balanceP90)} ·{" "}
          {fmt(data.withdrawalP90)}/mes
        </p>
      )}
    </Stack>
  );
};

const VPWSimulationResults = ({
  patrimony,
  monthlyExpenses,
  monthlySavings,
  monthlyWithdrawal,
  vpwRate,
  coverage,
  targetPatrimony,
  yearsRemaining,
  targetAge,
  allocationLabel,
  retirementTimingLabel,
  projection,
  showOtimista,
  showMediana,
  showPessimista,
  onScenarioVisibilityChange,
  hideValues,
}: Props) => {
  const tone = getCoverageTone(coverage);
  const verdict =
    tone === "good"
      ? "VPW cobre seus gastos hoje"
      : tone === "warn"
        ? "VPW quase cobre seus gastos"
        : "VPW ainda nao cobre seus gastos";
  const monthlyGap = monthlyWithdrawal - monthlyExpenses;
  const gapTone = monthlyGap >= 0 ? "good" : "bad";
  const gapLabel =
    monthlyGap >= 0
      ? `Sobra ${formatCurrency(monthlyGap)}/mes`
      : `Falta ${formatCurrency(Math.abs(monthlyGap))}/mes`;
  const incomeRows = buildVPWIncomeRows(projection).filter((row) => {
    if (row.key === "p10") return showPessimista;
    if (row.key === "p50") return showMediana;
    return showOtimista;
  });
  const pessimisticFloor = incomeRows.find((row) => row.key === "p10")?.value;
  const onlyOneScenario =
    [showOtimista, showMediana, showPessimista].filter(Boolean).length === 1;

  return (
    <Stack
      gap={2}
      sx={{
        mt: 2,
        pt: 2,
        borderTop: "1px solid",
        borderColor: getColor(Colors.neutral600),
      }}
    >
      <Stack gap={0.75}>
        <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
          Resultado da simulacao
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          VPW significa <em>Variable Percentage Withdrawal</em>, em portugues
          retirada percentual variavel. Ele recalcula a retirada todo ano; a
          leitura principal nao e uma falha binaria, mas quanto de renda o
          patrimonio sustenta e quanta queda pode aparecer nos cenarios ruins.
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
        }}
      >
        <Text
          size={FontSizes.SMALL}
          weight={FontWeights.SEMI_BOLD}
          extraStyle={{ color: toneColor(tone) }}
        >
          {verdict}
        </Text>
        <Text
          size={FontSizes.SEMI_LARGE}
          weight={FontWeights.BOLD}
          extraStyle={{ color: toneColor(tone), lineHeight: 1 }}
        >
          {hideValues ? "***" : `${coverage.toFixed(0)}%`}
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Retirada inicial de {valueOrHidden(hideValues, formatCurrency(monthlyWithdrawal))}/mes
          contra gasto desejado de {valueOrHidden(hideValues, formatCurrency(monthlyExpenses))}/mes.
        </Text>
        <Box
          sx={{
            width: "100%",
            maxWidth: 520,
            height: 12,
            borderRadius: 1,
            overflow: "hidden",
            backgroundColor: getColor(Colors.neutral600),
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${Math.min(coverage, 100)}%`,
              backgroundColor: toneColor(tone),
            }}
          />
        </Box>
      </Stack>

      <Stack direction="row" gap={1.25} flexWrap="wrap">
        <MetricBlock
          label="Patrimonio usado"
          value={formatCurrency(patrimony)}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Retirada inicial"
          value={`${formatCurrency(monthlyWithdrawal)}/mes`}
          sub={`${vpwRate.toFixed(1)}% a.a.`}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Gasto desejado"
          value={`${formatCurrency(monthlyExpenses)}/mes`}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Folga vs. gasto"
          value={gapLabel}
          tone={gapTone}
          hideValues={hideValues}
        />
      </Stack>

      <Stack direction="row" gap={1.25} flexWrap="wrap">
        <MetricBlock
          label="Alvo VPW hoje"
          value={formatCurrency(targetPatrimony)}
          sub="patrimonio que cobriria seus gastos"
          hideValues={hideValues}
        />
        <MetricBlock
          label="Aporte mensal"
          value={`${formatCurrency(Math.max(0, monthlySavings))}/mes`}
          sub={retirementTimingLabel}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Horizonte"
          value={`${yearsRemaining} anos`}
          sub={`ate os ${targetAge}`}
        />
        <MetricBlock
          label="Alocacao"
          value={allocationLabel}
        />
      </Stack>

      {incomeRows.length > 0 && (
        <Stack gap={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
          >
            <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
              O que pode acontecer com sua renda?
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
            Menor retirada mensal projetada se o VPW comecasse hoje com o
            patrimonio usado no cenario, em valores de hoje.
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
                <th>Retirada mensal minima</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row) => (
                <tr key={row.key}>
                  <td style={{ color: toneColor(row.tone), fontWeight: 700 }}>
                    {row.label}
                  </td>
                  <td>{valueOrHidden(hideValues, `${formatCurrency(row.value)}/mes`)}</td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </Box>
          {pessimisticFloor !== undefined && monthlyExpenses > 0 && (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Piso pessimista:{" "}
              <strong>
                {hideValues
                  ? "***"
                  : `${((pessimisticFloor / monthlyExpenses) * 100).toFixed(0)}%`}
              </strong>{" "}
              do gasto desejado.
            </Text>
          )}
        </Stack>
      )}

      {projection.length > 0 && (
        <Stack gap={1}>
          <Text
            size={FontSizes.EXTRA_SMALL}
            weight={FontWeights.MEDIUM}
            color={Colors.neutral200}
          >
            Aposentadoria · renda e patrimonio no cenario atual
          </Text>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            O grafico mostra a trajetoria se o VPW comecasse hoje. O tooltip
            mostra a retirada mensal recalculada em cada idade.
          </Text>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={projection}
              margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey="age"
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
                  <VPWTooltipContent
                    hideValues={hideValues}
                    showOtimista={showOtimista}
                    showMediana={showMediana}
                    showPessimista={showPessimista}
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
    </Stack>
  );
};

export default VPWSimulationResults;

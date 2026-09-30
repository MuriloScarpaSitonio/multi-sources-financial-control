import { useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import MuiTooltip from "@mui/material/Tooltip";
import {
  getFireSuccessBand,
  formatSimulationSuccessRate,
} from "../../Home/fireResultPresentation";
import { MetricBlock } from "../../Home/FireSimulationResults";
import FireAccumulationChart from "../../Home/FireAccumulationChart";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  InfoIconTooltip,
  Text,
} from "../../../../design-system";
import { useHideValues } from "../../../../hooks/useHideValues";
import { formatCurrency } from "../../utils";
import type { BootstrapBand } from "../../Home/fireBootstrap";
import type { VPWSimulationOutput } from "../../Home/vpwSimulation";
import type { VPWSnapshot } from "./vpwScenario";

const scenarios = [
  {
    key: "p10",
    label: "Pessimista",
    color: getColor(Colors.danger200),
    meaning: "90% das simulações ficaram neste valor ou acima.",
  },
  {
    key: "p50",
    label: "Mediano",
    color: getColor(Colors.brand200),
    meaning: "50% das simulações ficaram neste valor ou acima.",
  },
  {
    key: "p90",
    label: "Otimista",
    color: getColor(Colors.brand),
    meaning: "10% das simulações ficaram neste valor ou acima.",
  },
] as const;

export default function VPWResults({
  snapshot: s,
  output,
  comparison = false,
  scenarioVisibility,
  onScenarioVisibilityChange,
}: {
  snapshot: VPWSnapshot;
  output: VPWSimulationOutput;
  comparison?: boolean;
  scenarioVisibility?: Record<"p10" | "p50" | "p90", boolean>;
  onScenarioVisibilityChange?: (
    key: "p10" | "p50" | "p90",
    checked: boolean,
  ) => void;
}) {
  const { hideValues } = useHideValues();
  const [localVisible, setVisible] = useState({
    p10: true,
    p50: true,
    p90: true,
  });
  const visible = scenarioVisibility ?? localVisible;
  const money = (n: number) => (hideValues ? "***" : formatCurrency(n));
  const a = output.accumulation;
  const percent = (n: number) =>
    (n * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%";
  const extended = output.extendedAccumulation;
  const hasRetirement = !extended || extended.retirementTrialCount > 0;
  const progress =
    output.targetPatrimony > 0
      ? (s.actualPatrimony / output.targetPatrimony) * 100
      : 100;
  const minimumIncome = output.retirement.minimumMonthlyIncome.p10;
  const gap = minimumIncome - s.monthlyExpenses;
  const coversSpending = gap >= -0.005;
  const successRate = output.retirement.successRate;
  const band = getFireSuccessBand(successRate ?? 0);
  const resultColor =
    band === "warn"
      ? "#f59e0b"
      : getColor(band === "good" ? Colors.brand : Colors.danger200);
  const verdict =
    band === "good"
      ? "Plano historicamente robusto"
      : band === "warn"
        ? "Plano exige cautela"
        : "Plano historicamente frágil";
  const failedTrials = Math.round(
    (1 - (successRate ?? 0)) * output.retirement.trialCount,
  );
  const safeSpending = output.retirement.safeMonthlySpending;
  const safeGap =
    safeSpending === null ? null : safeSpending - s.monthlyExpenses;
  const scenarioProgress =
    output.targetPatrimony > 0
      ? (s.patrimony / output.targetPatrimony) * 100
      : 100;
  const yearsToRetirement = extended
    ? extended.medianYearsToRetirement
    : s.actualPatrimony >= output.targetPatrimony
      ? 0
      : (a?.medianYearsToTarget ?? null);
  const retirementLabel =
    yearsToRetirement === null
      ? extended
        ? "Sem início de retiradas"
        : "Meta não alcançada"
      : yearsToRetirement === 0
        ? "Hoje"
        : `Aos ${s.currentAge + yearsToRetirement} anos`;
  const retirementContext =
    yearsToRetirement === null
      ? !extended && s.monthlySavings <= 0
        ? "Informe aportes positivos para estimar"
        : "No horizonte simulado"
      : yearsToRetirement === 0
        ? "Patrimônio atual já alcança a meta VPW"
        : extended
          ? "Mediana entre simulações que começaram as retiradas"
          : "Mediana entre simulações que atingiram a meta";
  const spendingScenarios = output.retirement.sustainableMonthlySpending;
  const spendingGap = (income: number) => {
    if (hideValues) return "***";
    const difference = s.monthlyExpenses - income;
    if (Math.abs(difference) <= 0.005) return "Sem folga nem falta";
    return `${difference > 0 ? "Faltam" : "Sobram"} ${formatCurrency(Math.abs(difference))}/mês`;
  };
  const chart = (bands: BootstrapBand[]) => {
    if (!bands.length) return null;
    const data = bands.map((b) => ({ ...b, age: s.currentAge + b.year }));
    return (
      <Stack gap={1.75} sx={{ minWidth: 0 }}>
        <Stack gap={0.5} sx={{ mt: 1 }}>
          <Text
            size={FontSizes.SMALL}
            weight={FontWeights.SEMI_BOLD}
            color={Colors.neutral200}
          >
            Aposentadoria · trajetória do patrimônio no cenário atual
          </Text>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Sucesso até os {s.targetAge} anos:{" "}
            <strong>
              {hideValues
                ? "***"
                : successRate === null
                  ? "—"
                  : formatSimulationSuccessRate(successRate)}
            </strong>
            {" · "}Gastos: <strong>{money(s.monthlyExpenses)}/mês</strong>
          </Text>
        </Stack>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
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
              tickFormatter={(v: number) => {
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return v.toFixed(0);
              }}
              tickCount={hideValues ? 0 : undefined}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as BootstrapBand & {
                  age: number;
                };
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
                      Idade: {point.age}
                    </p>
                    {scenarios
                      .filter((item) => visible[item.key])
                      .map((item) => (
                        <p key={item.key} style={{ color: item.color }}>
                          {item.key === "p50" ? "Mediana" : item.label} (
                          {item.key}): {money(point[item.key])}
                        </p>
                      ))}
                  </Stack>
                );
              }}
            />
            {scenarios
              .filter((item) => visible[item.key])
              .map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={
                    item.key === "p50"
                      ? "Mediana"
                      : `${item.key} (${item.label.toLowerCase()})`
                  }
                  stroke={item.color}
                  strokeWidth={item.key === "p50" ? 2 : 1.5}
                  strokeDasharray={item.key === "p50" ? undefined : "4 3"}
                  dot={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </Stack>
    );
  };
  return (
    <Stack gap={2}>
      {extended && (
        <Stack gap={0.5} sx={{ mb: 1.5 }}>
          <Text size={FontSizes.EXTRA_SMALL}>
            Aportes por mais {extended.extraYears}{" "}
            {extended.extraYears === 1 ? "ano" : "anos"} após atingir a meta
            VPW.
          </Text>
          {hasRetirement ? (
            <>
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                Início das retiradas em {extended.medianYearsToRetirement} anos
                · Patrimônio projetado: {money(extended.medianStartingBalance!)}{" "}
                (medianas).
              </Text>
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                As retiradas terminam aos {s.targetAge} anos.
              </Text>
              {extended.retirementStartRate < 1 && (
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                  {formatSimulationSuccessRate(extended.retirementStartRate)}{" "}
                  das simulações começaram as retiradas antes da idade alvo. Os
                  resultados de renda consideram apenas essas simulações.
                </Text>
              )}
            </>
          ) : (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
              Nenhuma simulação completou os anos extras de acumulação antes dos{" "}
              {s.targetAge} anos. Não há projeção de retiradas para este plano.
            </Text>
          )}
        </Stack>
      )}
      <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
        Resultado da simulação
      </Text>
      {!extended && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Retiradas a partir de hoje, com {money(s.patrimony)}, até os{" "}
          {s.targetAge} anos.
        </Text>
      )}
      {hasRetirement && (
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
            extraStyle={{ color: resultColor }}
          >
            {verdict}
          </Text>
          <Text
            size={FontSizes.SEMI_LARGE}
            weight={FontWeights.BOLD}
            extraStyle={{ color: resultColor, lineHeight: 1 }}
          >
            {hideValues ? "***" : formatSimulationSuccessRate(successRate ?? 0)}
          </Text>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
            Chance histórica de sustentar {money(s.monthlyExpenses)}/mês{" "}
            {extended
              ? `até os ${s.targetAge} anos após a acumulação`
              : `por ${s.years} anos se a aposentadoria começasse hoje`}
            :{" "}
            {hideValues
              ? "***"
              : failedTrials === 0
                ? "nenhum cenário falhou"
                : `${failedTrials} de ${output.retirement.trialCount} cenários falharam`}
            .
          </Text>
        </Stack>
      )}
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: comparison
            ? "1fr"
            : { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <MetricBlock
          label="Patrimônio atual"
          value={money(s.actualPatrimony)}
          hideValues={hideValues}
        >
          <MuiTooltip
            arrow
            describeChild
            title={`Mostra quanto da meta VPW já é coberto pelo patrimônio atual da carteira. Meta para 95% de sucesso nas retiradas: ${money(output.targetPatrimony)}.`}
          >
            <Box tabIndex={0} sx={{ position: "relative", mt: 0.5 }}>
              <LinearProgress
                variant="determinate"
                value={hideValues ? 0 : Math.min(100, Math.max(0, progress))}
                aria-label="Progresso do patrimônio atual até a meta VPW"
                aria-valuetext={
                  hideValues ? "***" : `${progress.toFixed(0)}% da meta VPW`
                }
                sx={{
                  height: 14,
                  borderRadius: "4px",
                  backgroundColor: getColor(Colors.neutral600),
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: getColor(
                      hideValues
                        ? Colors.neutral600
                        : progress >= 100
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
                {hideValues ? "***" : `${progress.toFixed(0)}%`}
              </Text>
            </Box>
          </MuiTooltip>
        </MetricBlock>
        <MetricBlock
          label="Meta VPW"
          value={money(output.targetPatrimony)}
          hideValues={hideValues}
          sub={
            <>
              {hideValues
                ? "***"
                : Math.abs(scenarioProgress - 100) < 1e-8
                  ? "Meta atingida"
                  : `${Math.abs(scenarioProgress - 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ${scenarioProgress > 100 ? "acima" : "abaixo"} da meta`}{" "}
              <InfoIconTooltip text="Patrimônio estimado para começar as retiradas hoje e cobrir seus gastos até a idade final em pelo menos 95% das simulações. A comparação usa o patrimônio deste cenário." />
            </>
          }
        />
        <MetricBlock
          label="Renda no pior ano · cenário pessimista"
          value={hasRetirement ? `${money(minimumIncome)}/mês` : "—"}
          sub="Média mensal no ano de menor renda"
          tone={hasRetirement && !coversSpending ? "bad" : "good"}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Gasto seguro estimado"
          value={safeSpending === null ? "—" : `${money(safeSpending)}/mês`}
          sub={
            extended
              ? "Para 90% de sucesso, mantendo os inícios de retirada deste cenário"
              : "Para 90% de sucesso nas retiradas"
          }
          hideValues={hideValues}
        />
        <MetricBlock
          label="Quando posso começar as retiradas?"
          value={retirementLabel}
          sub={retirementContext}
          hideValues={hideValues}
        />
        <MetricBlock
          label="Folga do gasto seguro"
          value={
            safeGap === null
              ? "—"
              : `${safeGap >= 0 ? "Sobram" : "Faltam"} ${money(Math.abs(safeGap))}/mês`
          }
          sub="Gasto seguro estimado menos seus gastos"
          tone={safeGap !== null && safeGap < 0 ? "bad" : "good"}
          hideValues={hideValues}
        />
      </Box>
      {hasRetirement && spendingScenarios && (
        <Stack gap={1.75}>
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
              {scenarios.map((item) => (
                <FormControlLabel
                  key={item.key}
                  label={item.label}
                  control={
                    <Checkbox
                      checked={visible[item.key]}
                      disabled={
                        visible[item.key] &&
                        Object.values(visible).filter(Boolean).length === 1
                      }
                      onChange={(_, checked) =>
                        onScenarioVisibilityChange
                          ? onScenarioVisibilityChange(item.key, checked)
                          : setVisible((v) => ({ ...v, [item.key]: checked }))
                      }
                    />
                  }
                />
              ))}
            </Stack>
          </Stack>
          <Text size={FontSizes.EXTRA_SMALL}>
            Gasto mensal que poderia ser mantido até os {s.targetAge} anos, em
            valores de hoje, comparado aos seus gastos de{" "}
            {money(s.monthlyExpenses)}/mês.
            {!extended && " A estimativa considera retiradas a partir de hoje."}
          </Text>
          <Box
            component="table"
            aria-label="Gasto mensal sustentável"
            sx={{
              width: "100%",
              borderCollapse: "collapse",
              "& th, & td": {
                textAlign: "left",
                borderBottom: "1px solid",
                borderColor: getColor(Colors.neutral600),
                py: 1,
                px: 1,
                fontSize: 12,
              },
              "& th": { color: getColor(Colors.neutral300), fontWeight: 700 },
              "& td": { color: getColor(Colors.neutral200) },
            }}
          >
            <thead>
              <tr>
                <th>Cenário</th>
                <th>Gasto mensal sustentável</th>
                <th>Folga ou falta</th>
                <th>Leitura</th>
              </tr>
            </thead>
            <tbody>
              {scenarios
                .filter((item) => visible[item.key])
                .map((item) => (
                  <tr key={item.key}>
                    <td style={{ color: item.color, fontWeight: 700 }}>
                      {item.label}
                    </td>
                    <td>{money(spendingScenarios[item.key])}</td>
                    <td>{spendingGap(spendingScenarios[item.key])}</td>
                    <td>{item.meaning}</td>
                  </tr>
                ))}
            </tbody>
          </Box>
        </Stack>
      )}
      {chart(output.retirement.balanceBands)}
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        {extended &&
          "Em cada idade, os gráficos incluem apenas as simulações que já começaram as retiradas. "}
        Os percentis de cada ano não representam uma única trajetória. O limite
        mensal pode deixar patrimônio ao final do prazo.
      </Text>
      <Stack gap={2}>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          {s.monthlySavings <= 0 ? (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              Informe um aporte mensal positivo para estimar quando atingirá a
              meta.
            </Text>
          ) : (
            a && (
              <Text
                size={FontSizes.EXTRA_SMALL}
                color={
                  a.medianYearsToTarget === null
                    ? Colors.danger200
                    : Colors.neutral400
                }
              >
                No ritmo de {money(s.monthlySavings)}/mês:{" "}
                {a.medianYearsToTarget === null ? (
                  <>
                    meta não atingida em {s.accumulationYears}{" "}
                    {s.accumulationYears === 1 ? "ano" : "anos"}
                  </>
                ) : (
                  <>
                    mediana <strong>{a.medianYearsToTarget}a</strong>
                    {" · "}otimista (p10) {a.p10YearsToTarget ?? "—"}a{" · "}
                    pessimista (p90) {a.p90YearsToTarget ?? "—"}a
                  </>
                )}
                {" · "}sucesso {hideValues ? "***" : percent(a.successRate)} em{" "}
                {s.accumulationYears}a
              </Text>
            )
          )}
        </Stack>
        {a && s.monthlySavings > 0 && a.gapBands.length > 1 && (
          <FireAccumulationChart
            strategy="VPW"
            accumulation={a}
            currentAge={s.currentAge}
            hideValues={hideValues}
            showOtimista={visible.p90}
            showMediana={visible.p50}
            showPessimista={visible.p10}
          />
        )}
      </Stack>
    </Stack>
  );
}

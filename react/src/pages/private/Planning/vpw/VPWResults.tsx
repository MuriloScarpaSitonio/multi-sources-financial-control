import { useState } from "react";
import Box from "@mui/material/Box";
import {
  getFireSuccessBand,
  formatSimulationSuccessRate,
} from "../../Home/fireResultPresentation";
import { MetricBlock } from "../../Home/FireSimulationResults";
import FireAccumulationChart from "../../Home/FireAccumulationChart";
import Stack from "@mui/material/Stack";
import {
  ChartTooltipBox,
  GoalProgressBar,
  PercentileTrajectoryChart,
  ScenarioTable,
  ScenarioToggles,
  SuccessVerdictCard,
  percentileColor,
  type PercentileVisibility,
} from "../shared/simulationResultParts";
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
    color: percentileColor("p10"),
    meaning: "90% das simulações ficaram neste valor ou acima.",
  },
  {
    key: "p50",
    label: "Mediano",
    color: percentileColor("p50"),
    meaning: "50% das simulações ficaram neste valor ou acima.",
  },
  {
    key: "p90",
    label: "Otimista",
    color: percentileColor("p90"),
    meaning: "10% das simulações ficaram neste valor ou acima.",
  },
] as const;

const BandTooltip = ({
  active,
  payload,
  visible,
  money,
}: {
  active?: boolean;
  payload?: { payload: BootstrapBand & { age: number } }[];
  visible: PercentileVisibility;
  money: (n: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p style={{ color: getColor(Colors.neutral300) }}>Idade: {point.age}</p>
      {scenarios
        .filter((item) => visible[item.key])
        .map((item) => (
          <p key={item.key} style={{ color: item.color }}>
            {item.key === "p50" ? "Mediana" : item.label} ({item.key}):{" "}
            {money(point[item.key])}
          </p>
        ))}
    </ChartTooltipBox>
  );
};

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
        <PercentileTrajectoryChart
          subtitle={
            <>
              Sucesso até os {s.targetAge} anos:{" "}
              <strong>
                {hideValues
                  ? "***"
                  : successRate === null
                    ? "—"
                    : formatSimulationSuccessRate(successRate)}
              </strong>
              {" · "}Gastos: <strong>{money(s.monthlyExpenses)}/mês</strong>
            </>
          }
          data={data}
          xKey="age"
          dataKeys={{ p10: "p10", p50: "p50", p90: "p90" }}
          visible={visible}
          hideValues={hideValues}
          tooltip={<BandTooltip visible={visible} money={money} />}
        />
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
        <SuccessVerdictCard
          band={band}
          verdict={verdict}
          rate={
            hideValues ? "***" : formatSimulationSuccessRate(successRate ?? 0)
          }
        >
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
        </SuccessVerdictCard>
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
          <GoalProgressBar
            progress={progress}
            goalLabel="meta VPW"
            hideValues={hideValues}
            tooltip={`Mostra quanto da meta VPW já é coberto pelo patrimônio atual da carteira. Meta para 95% de sucesso nas retiradas: ${money(output.targetPatrimony)}.`}
          />
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
            <ScenarioToggles
              visible={visible}
              onChange={(key, checked) =>
                onScenarioVisibilityChange
                  ? onScenarioVisibilityChange(key, checked)
                  : setVisible((v) => ({ ...v, [key]: checked }))
              }
            />
          </Stack>
          <Text size={FontSizes.EXTRA_SMALL}>
            Gasto mensal que poderia ser mantido até os {s.targetAge} anos, em
            valores de hoje, comparado aos seus gastos de{" "}
            {money(s.monthlyExpenses)}/mês.
            {!extended && " A estimativa considera retiradas a partir de hoje."}
          </Text>
          <ScenarioTable ariaLabel="Gasto mensal sustentável">
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
          </ScenarioTable>
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

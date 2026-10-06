import { Bar, YAxis, ReferenceLine } from "recharts";
import { useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import {
  getFireSuccessBand,
  formatSimulationSuccessRate,
} from "../../Home/fireResultPresentation";
import { MetricBlock } from "../../Home/FireSimulationResults";
import FireAccumulationChart from "../../Home/FireAccumulationChart";
import Stack from "@mui/material/Stack";
import {
  ChartTooltipBox,
  compactNumberTick,
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
import type { OneOverNSimulationOutput } from "../../Home/oneOverNSimulation";
import type { OneOverNSnapshot } from "./oneOverNScenario";

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

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

type ScenarioKey = (typeof scenarios)[number]["key"];
const withdrawalColors: Record<ScenarioKey, string> = {
  p10: "#93c5fd",
  p50: "#60a5fa",
  p90: "#3b82f6",
};

type RetirementPoint = BootstrapBand & {
  age: number;
  income_p10?: number;
  income_p50?: number;
  income_p90?: number;
};

const DrawdownTooltip = ({
  active,
  payload,
  visible,
  hidden,
  showWithdrawals,
}: {
  active?: boolean;
  payload?: { payload: RetirementPoint }[];
  visible: PercentileVisibility;
  hidden: boolean;
  showWithdrawals: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const income = {
    p10: point.income_p10,
    p50: point.income_p50,
    p90: point.income_p90,
  };
  const hasIncome = scenarios.some(
    (item) => visible[item.key] && income[item.key] !== undefined,
  );
  const showIncome = showWithdrawals && hasIncome;
  const value = (amount: number | undefined) =>
    amount === undefined
      ? "—"
      : hidden
        ? "***"
        : compactCurrency.format(amount);
  return (
    <ChartTooltipBox sx={{ maxWidth: 360 }}>
      <p style={{ color: getColor(Colors.neutral300) }}>
        Ano {point.year} (idade {point.age})
      </p>
      <table
        aria-label="Valores da aposentadoria"
        style={{ borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr style={{ color: getColor(Colors.neutral300) }}>
            <th scope="col" style={{ textAlign: "left" }}>
              Cenário
            </th>
            <th scope="col" style={{ paddingLeft: 12, textAlign: "right" }}>
              Patrimônio
            </th>
            {showIncome && (
              <th scope="col" style={{ paddingLeft: 12, textAlign: "right" }}>
                Retirada/mês
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {scenarios
            .filter((item) => visible[item.key])
            .map((item) => (
              <tr key={item.key}>
                <td style={{ color: item.color, whiteSpace: "nowrap" }}>
                  {item.key === "p50" ? "Mediana" : item.label}
                </td>
                <td
                  style={{
                    color: item.color,
                    paddingLeft: 12,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value(point[item.key])}
                </td>
                {showIncome && (
                  <td
                    style={{
                      color: withdrawalColors[item.key],
                      paddingLeft: 12,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value(income[item.key])}
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </ChartTooltipBox>
  );
};

export default function OneOverNResults({
  snapshot: s,
  output,
  comparison = false,
  scenarioVisibility,
  onScenarioVisibilityChange,
}: {
  snapshot: OneOverNSnapshot;
  output: OneOverNSimulationOutput;
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
  const [showWithdrawals, setShowWithdrawals] = useState(false);
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
  const minimumIncome = output.retirement.minimumMonthlyIncome?.p10 ?? 0;
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
        ? "Patrimônio atual já alcança a meta 1/N"
        : extended
          ? "Mediana entre simulações que começaram as retiradas"
          : "Mediana entre simulações que atingiram a meta";
  const spendingScenarios = output.retirement.minimumMonthlyIncome;
  const spendingGap = (income: number) => {
    if (hideValues) return "***";
    const difference = s.monthlyExpenses - income;
    if (Math.abs(difference) <= 0.005) return "Sem folga nem falta";
    return `${difference > 0 ? "Faltam" : "Sobram"} ${formatCurrency(Math.abs(difference))}/mês`;
  };
  const chart = (bands: BootstrapBand[]) => {
    if (!bands.length) return null;
    const incomes = new Map(
      output.retirement.withdrawalBands.map((b) => [b.year, b]),
    );
    const data = bands.map((b) => {
      const income = incomes.get(b.year);
      return {
        ...b,
        age: s.currentAge + b.year,
        income_p10: income?.p10,
        income_p50: income?.p50,
        income_p90: income?.p90,
      };
    });
    const withdrawalSwitch = (
      <FormControlLabel
        control={
          <Switch
            size="small"
            inputProps={{ role: "switch" }}
            checked={showWithdrawals}
            onChange={(_, checked) => setShowWithdrawals(checked)}
          />
        }
        label="Mostrar retiradas"
        sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
      />
    );
    return (
      <PercentileTrajectoryChart
        subtitle={
          showWithdrawals
            ? `Linhas: patrimônio restante. Barras azuis: retirada mensal. Gastos de referência: ${money(s.monthlyExpenses)}/mês.`
            : "Patrimônio restante nos cenários selecionados."
        }
        headerAction={withdrawalSwitch}
        data={data}
        xKey="age"
        dataKeys={{ p10: "p10", p50: "p50", p90: "p90" }}
        visible={visible}
        hideValues={hideValues}
        tooltip={
          <DrawdownTooltip
            visible={visible}
            hidden={hideValues}
            showWithdrawals={showWithdrawals}
          />
        }
        chartOverlay={
          showWithdrawals
            ? {
                axis: (
                  <YAxis
                    yAxisId="income"
                    orientation="right"
                    stroke={withdrawalColors.p50}
                    tick={{ fill: withdrawalColors.p50 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={compactNumberTick}
                    tickCount={hideValues ? 0 : undefined}
                    label={{
                      value: "R$/mês",
                      angle: 90,
                      position: "insideRight",
                      fill: withdrawalColors.p50,
                      fontSize: 12,
                    }}
                  />
                ),
                behindLines: (
                  <>
                    {scenarios
                      .filter((item) => visible[item.key])
                      .map((item) => (
                        <Bar
                          key={`income-${item.key}`}
                          yAxisId="income"
                          dataKey={`income_${item.key}`}
                          name={`Retirada · ${item.label}`}
                          fill={withdrawalColors[item.key]}
                          fillOpacity={0.65}
                          stroke={withdrawalColors[item.key]}
                        />
                      ))}
                  </>
                ),
                aboveLines: (
                  <ReferenceLine
                    yAxisId="income"
                    y={s.monthlyExpenses}
                    stroke={getColor(Colors.danger200)}
                    strokeDasharray="5 5"
                  />
                ),
              }
            : undefined
        }
      />
    );
  };
  return (
    <Stack gap={2}>
      {extended && (
        <Stack gap={0.5} sx={{ mb: 1.5 }}>
          <Text size={FontSizes.EXTRA_SMALL}>
            Aportes por mais {extended.extraYears}{" "}
            {extended.extraYears === 1 ? "ano" : "anos"} após atingir a meta
            1/N.
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
            goalLabel="meta 1/N"
            hideValues={hideValues}
            tooltip={`Mostra quanto da meta 1/N já é coberto pelo patrimônio atual da carteira. Meta para 95% de sucesso nas retiradas: ${money(output.targetPatrimony)}.`}
          />
        </MetricBlock>
        <MetricBlock
          label="Meta 1/N"
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
            Média mensal no ano de menor retirada de cada simulação, em valores
            de hoje, comparada aos seus gastos de {money(s.monthlyExpenses)}
            /mês.
            {!extended && " A estimativa considera retiradas a partir de hoje."}
          </Text>
          <ScenarioTable ariaLabel="Renda no pior ano">
            <thead>
              <tr>
                <th>Cenário</th>
                <th>Renda no pior ano</th>
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
        Os percentis de cada ano não representam uma única trajetória. A
        retirada é recalculada anualmente e gasta integralmente; o saldo termina
        em zero na idade alvo.
      </Text>
      <Stack gap={2}>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          {s.monthlySavings < 0 && (
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger200}>
              Déficit mensal: {money(Math.abs(s.monthlySavings))}. A simulação
              preserva esse fluxo negativo.
            </Text>
          )}
          <Text size={FontSizes.EXTRA_SMALL}>
            Meta{" "}
            {a.medianYearsToTarget === null
              ? "não alcançada no horizonte simulado"
              : `atingida em ${a.medianYearsToTarget} anos (mediana)`}
            . Sucesso na acumulação:{" "}
            {hideValues ? "***" : percent(a.successRate)}.
          </Text>
        </Stack>
        {a.gapBands.length > 1 && (
          <FireAccumulationChart
            strategy="1/N"
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

import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import { Text, FontSizes } from "../../../../design-system";
import { formatCurrency } from "../../utils";
import { useHideValues } from "../../../../hooks/useHideValues";
import WalkthroughFrame from "../shared/WalkthroughFrame";
import {
  PercentileTrajectoryChart,
  ChartTooltipBox,
} from "../shared/simulationResultParts";
import { preparePortfolio, mulberry32 } from "../../Home/fireBootstrap";
import {
  traceOneOverNPlan,
  type OneOverNSimulationOutput,
} from "../../Home/oneOverNSimulation";
import type { OneOverNSnapshot } from "./oneOverNScenario";
const TraceTooltip = ({
  active,
  payload,
  money,
}: {
  active?: boolean;
  payload?: { value?: number; name?: string }[];
  money: (value: number) => string;
}) =>
  active && payload?.length ? (
    <ChartTooltipBox>
      {payload.map((row, i) => (
        <p key={i}>
          {row.name}: {money(row.value ?? 0)}
        </p>
      ))}
    </ChartTooltipBox>
  ) : null;
const STEPS = [
  "Sorteando meses históricos",
  "Um aposentado simulado",
  "2000 aposentados ao mesmo tempo",
  "Procurando a meta 1/N",
];
export default function OneOverNMethodologyWalkthrough({
  snapshot: s,
  output,
}: {
  snapshot: OneOverNSnapshot;
  output: OneOverNSimulationOutput | null;
}) {
  const [step, setStep] = useState(0),
    [seed, setSeed] = useState(1);
  const { hideValues } = useHideValues();
  const money = (v: number) => (hideValues ? "***" : formatCurrency(v));
  const prepared = useMemo(
    () => preparePortfolio(s.portfolio, s.request.input.samplingMethod),
    [s],
  );
  const sampled = useMemo(
    () => prepared.sampleMonths(s.years * 12, mulberry32(seed)),
    [prepared, seed, s.years],
  );
  const trace = useMemo(
    () =>
      s.extraYears > 0 && !output
        ? null
        : traceOneOverNPlan(
            s.request.input,
            output?.targetsByYear ?? [],
            sampled.map((i) => prepared.returns[i]),
          ),
    [s, output, sampled, prepared],
  );
  const retirement = trace?.retirement;
  const start = trace?.retirementStartYear ?? 0;
  const visible = { p10: true, p50: true, p90: true };
  return (
    <WalkthroughFrame
      idPrefix="one-over-n"
      title="Como calculamos a retirada e a meta 1/N"
      description="Os 4 passos mostram como sua carteira e seu cenário são usados para calcular as retiradas e a meta 1/N."
      portfolio={s.portfolio}
      steps={STEPS}
      activeStep={step}
      onStepChange={setStep}
    >
      <Stack gap={1.5}>
        {step === 0 && (
          <>
            <Text size={FontSizes.EXTRA_SMALL}>
              Sorteamos meses históricos da sua carteira, em valores descontados
              da inflação. Todos os ativos usam o mesmo mês sorteado,
              preservando os movimentos conjuntos.
            </Text>
            <Text size={FontSizes.EXTRA_SMALL}>
              {s.request.input.samplingMethod === "independent_months"
                ? "Cada mês é sorteado independentemente."
                : "Sorteamos blocos de 12 meses consecutivos."}
            </Text>
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {sampled.slice(0, 24).map((index, i) => (
                <Chip key={i} size="small" label={s.historyMonths[index]} />
              ))}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSeed((v) => v + 1)}
            >
              Sortear outra sequência
            </Button>
          </>
        )}
        {step === 1 && (
          <>
            <Text size={FontSizes.EXTRA_SMALL}>
              A cada ano, dividimos o saldo pelos anos restantes e gastamos o
              valor integral calculado, distribuído nos pagamentos mensais. Os
              gastos informados são uma referência, sem limitar a retirada.
            </Text>
            <Text size={FontSizes.EXTRA_SMALL}>
              {hideValues
                ? "***"
                : "R$ 600.000 ÷ 20 anos = R$ 30.000 para gastar naquele ano (R$ 2.500/mês)."}
            </Text>
            {retirement ? (
              <>
                <Text size={FontSizes.EXTRA_SMALL}>
                  No primeiro ano deste cenário: {money(retirement.balances[0])}{" "}
                  ÷ {s.years - start} anos ={" "}
                  {money(retirement.annualWithdrawals[0])}/ano (
                  {money(retirement.annualWithdrawals[0] / 12)}/mês). As
                  retiradas terminam aos {s.targetAge} anos.
                </Text>
                <PercentileTrajectoryChart
                  subtitle="Valores descontados da inflação"
                  tooltip={<TraceTooltip money={money} />}
                  title="Um aposentado · patrimônio restante"
                  data={retirement.balances.map((balance, year) => ({
                    age: s.currentAge + start + year,
                    p10: balance,
                    p50: balance,
                    p90: balance,
                  }))}
                  xKey="age"
                  dataKeys={{ p10: "p10", p50: "p50", p90: "p90" }}
                  visible={{ p10: false, p50: true, p90: false }}
                  hideValues={hideValues}
                />
                <Text size={FontSizes.EXTRA_SMALL}>
                  Menor retirada anual ÷ 12 nesta sequência:{" "}
                  {money(retirement.minimumMonthlyIncome)}/mês.
                </Text>
              </>
            ) : (
              <Text size={FontSizes.EXTRA_SMALL}>
                {output
                  ? "Esta sequência não começou as retiradas antes da idade alvo."
                  : "Aguardando o cálculo da meta deste cenário."}
              </Text>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSeed((v) => v + 1)}
            >
              Sortear outra sequência
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Text size={FontSizes.EXTRA_SMALL}>
              Repetimos o processo para 2.000 sequências históricas. Verificamos
              se a retirada cobre seus gastos em todos os anos até a idade alvo.
              Cada simulação gasta integralmente a sua retirada 1/N.
            </Text>
            {output ? (
              <>
                <Text size={FontSizes.EXTRA_SMALL}>
                  {output.retirement.trialCount} simulações começaram as
                  retiradas. Cobertura durante todo o período:{" "}
                  {hideValues
                    ? "***"
                    : output.retirement.successRate === null
                      ? "sem início de retiradas"
                      : `${(output.retirement.successRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                  .
                </Text>
                {output.retirement.withdrawalBands.length > 0 && (
                  <PercentileTrajectoryChart
                    subtitle="Valores descontados da inflação"
                    tooltip={<TraceTooltip money={money} />}
                    title="Retiradas nas simulações · média mensal de cada ano"
                    data={output.retirement.withdrawalBands.map((b) => ({
                      ...b,
                      age: s.currentAge + b.year,
                    }))}
                    xKey="age"
                    dataKeys={{ p10: "p10", p50: "p50", p90: "p90" }}
                    visible={visible}
                    hideValues={hideValues}
                  />
                )}
                <Text size={FontSizes.EXTRA_SMALL}>
                  Com anos extras de acumulação, a cobertura considera as
                  simulações que começaram a retirar; a proporção que começou é
                  exibida separadamente no resultado.
                </Text>
              </>
            ) : (
              <Text size={FontSizes.EXTRA_SMALL}>
                Aguardando o resultado da simulação.
              </Text>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <Text size={FontSizes.EXTRA_SMALL}>
              A meta é o patrimônio necessário para começar as retiradas hoje e
              cobrir seus gastos até os {s.targetAge} anos em pelo menos 95% das
              sequências: 1.900 de 2.000 simulações.
            </Text>
            <Text size={FontSizes.EXTRA_SMALL}>
              Gastos de referência: {money(s.monthlyExpenses)}/mês. Meta 1/N:{" "}
              {output ? money(output.targetPatrimony) : "calculando…"}.
            </Text>
            <Text size={FontSizes.EXTRA_SMALL}>
              A busca considera o ano de menor retirada de cada sequência, não
              apenas a renda inicial. Durante a acumulação, recalculamos a meta
              para o prazo restante; a idade alvo permanece a mesma.
            </Text>
            <Text size={FontSizes.EXTRA_SMALL}>
              Os históricos não garantem os resultados futuros.
            </Text>
          </>
        )}
      </Stack>
    </WalkthroughFrame>
  );
}

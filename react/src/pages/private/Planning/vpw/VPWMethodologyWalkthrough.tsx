import WalkthroughFrame from "../shared/WalkthroughFrame";
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  Text,
} from "../../../../design-system";
import type { VPWSimulationRequest } from "../../Home/fireSimulation";
import { useFireSimulationWorker } from "../../Home/useFireSimulationWorker";
import { mulberry32, sampleMonthKeys } from "../../Home/fireBootstrap";
import type { VPWSnapshot } from "./vpwScenario";
import { formatCurrency } from "../../utils";
import { useHideValues } from "../../../../hooks/useHideValues";
import { prepareVPWPlanTrace } from "./vpwWalkthrough";

const STEPS = [
  "Sorteando meses históricos",
  "Um aposentado simulado",
  "2000 aposentados ao mesmo tempo",
  "Procurando a meta VPW",
];
const percent = (value: number) =>
  `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;
const compact = (value: number) =>
  value >= 1000000
    ? `R$ ${(value / 1000000).toFixed(1)}M`
    : value >= 1000
      ? `R$ ${(value / 1000).toFixed(0)}k`
      : `R$ ${value.toFixed(0)}`;
const Note = ({ children }: { children: React.ReactNode }) => (
  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
    {children}
  </Text>
);

export default function VPWMethodologyWalkthrough({
  snapshot,
}: {
  snapshot: VPWSnapshot;
}) {
  const { hideValues } = useHideValues();
  const money = (value: number) => (hideValues ? "***" : formatCurrency(value));
  const [step, setStep] = useState(0);
  const {
    years,
    monthlyExpenses: spending,
    patrimony: wealth,
    historyMonths,
  } = snapshot;
  const method = snapshot.request.input.samplingMethod;
  const [seed, setSeed] = useState(42);
  const [retry, setRetry] = useState(0);
  const needsTrace = step !== 0;
  const prepared = useMemo(() => {
    if (!needsTrace) return { run: null, error: null };
    try {
      return { run: prepareVPWPlanTrace(snapshot), error: null };
    } catch (error) {
      return {
        run: null,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível simular esse cenário.",
      };
    }
  }, [snapshot, needsTrace]);
  const sample = useMemo(() => {
    try {
      return {
        months: sampleMonthKeys({
          eligible: historyMonths,
          method,
          count: Math.min(24, years * 12),
          rng: mulberry32(seed),
        }),
        error: null,
      };
    } catch (error) {
      return {
        months: [],
        error:
          error instanceof Error
            ? error.message
            : "Histórico indisponível para este cenário.",
      };
    }
  }, [historyMonths, method, seed, years]);
  const sampledMonths = sample.months;
  const trace = useMemo(() => prepared.run?.(seed) ?? [], [prepared, seed]);
  const balancePath = useMemo(
    () => [
      { year: 0, balance: wealth },
      ...trace
        .filter((item) => item.month % 12 === 0)
        .map((item) => ({ year: item.month / 12, balance: item.nextBalance })),
    ],
    [trace, wealth],
  );
  const yearTicks = useMemo(
    () =>
      Array.from({ length: Math.min(6, years + 1) }, (_, index) =>
        Math.round((index * years) / Math.min(5, years)),
      ),
    [years],
  );
  const retirementMonths = trace.filter((item) => item.payment !== null);
  const firstShortfall = retirementMonths.find(
    (item) => spending - item.payment! > 0.005,
  );
  const ensemble = useMemo(() => {
    if (step !== 2 || !prepared.run) return null;
    const rng = mulberry32(42);
    const paths = Array.from({ length: 100 }, () => prepared.run!(rng));
    const failed = paths.map((path) =>
      path.some(
        (item) => item.payment !== null && spending - item.payment > 0.005,
      ),
    );
    // All months are shown: annual averages could hide a shortfall.
    const rows = Array.from({ length: years * 12 }, (_, month) =>
      Object.fromEntries([
        ["month", month + 1],
        ...paths.map((path, index) => [
          `t${index}`,
          path[month]?.payment ?? null,
        ]),
      ]),
    );
    return { rows, failed };
  }, [prepared, step, spending, years]);
  const request = useMemo<VPWSimulationRequest>(
    () => ({ ...snapshot.request }),
    // Retrying must replace the failed request even when inputs are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, retry],
  ); // A retry deliberately creates a fresh worker request.
  const worker = useFireSimulationWorker(step >= 2 ? request : null);
  const output =
    !worker.isCalculating && !worker.error ? worker.result?.output : null;
  const ready = Boolean(output);
  return (
    <WalkthroughFrame
      idPrefix="vpw"
      title="Como calculamos a retirada e a meta VPW"
      description="Os 4 passos mostram como sua carteira e seu cenário são usados para calcular as retiradas e a meta VPW."
      portfolio={snapshot.portfolio}
      steps={STEPS}
      activeStep={step}
      onStepChange={setStep}
    >
      <Stack gap={1.5}>
        {prepared.error && <Alert severity="warning">{prepared.error}</Alert>}
        {step === 0 && (
          <>
            <Note>
              Sorteamos meses do histórico da sua carteira para montar uma
              sequência de retornos ao longo dos anos do seu cenário. Um mesmo
              mês pode aparecer mais de uma vez.
            </Note>
            <Note>
              {method === "contiguous_12_month_blocks"
                ? "Sorteamos blocos de 12 meses consecutivos."
                : "Sorteamos cada mês de forma independente."}{" "}
              Todos os ativos usam o mesmo mês histórico, preservando a relação
              entre seus retornos.
            </Note>
            <Text size={FontSizes.EXTRA_SMALL}>
              Primeiros 24 meses sorteados
            </Text>
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {sampledMonths.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: getColor(Colors.brand),
                  }}
                >
                  <Text size={FontSizes.EXTRA_SMALL}>{monthLabel(item)}</Text>
                </Box>
              ))}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setSeed((value) => value + 1)}
              sx={{ alignSelf: "flex-start" }}
            >
              Sortear outra sequência
            </Button>
          </>
        )}
        {step === 1 && !prepared.error && (
          <>
            <Note>
              Aplicamos os retornos sorteados ao patrimônio e recalculamos o
              limite de retirada a cada mês. Se ele ficar abaixo da sua despesa
              mensal, a retirada diminui.
            </Note>
            <Note>
              Se houver anos extras de acumulação, mantemos os aportes até
              concluir essa etapa. Depois, cada retirada fica limitada à despesa
              mensal, ao limite VPW e ao saldo disponível. Os valores descontam
              a inflação.
            </Note>
            <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSeed((value) => value + 1)}
              >
                Sortear nova sequência
              </Button>
            </Stack>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={balancePath}
                margin={{ top: 10, right: 10, left: 5, bottom: 20 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="5" />
                <XAxis
                  dataKey="year"
                  type="number"
                  domain={[0, years]}
                  ticks={yearTicks}
                  minTickGap={30}
                  tickFormatter={(value) => `${value}`}
                  stroke={getColor(Colors.neutral0)}
                  tickLine={false}
                  label={{
                    value: "Ano da simulação",
                    position: "insideBottom",
                    offset: -10,
                    fill: getColor(Colors.neutral400),
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    hideValues ? "***" : compact(value)
                  }
                  stroke={getColor(Colors.brand400)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    !active || !payload?.length ? null : (
                      <Stack
                        spacing={0.5}
                        sx={{
                          border: "1px solid",
                          p: 1,
                          borderColor: getColor(Colors.brand400),
                          backgroundColor: getColor(Colors.neutral600),
                        }}
                      >
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          color={Colors.neutral300}
                        >
                          Ano {label}
                        </Text>
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          color={Colors.brand200}
                        >
                          Saldo:{" "}
                          {hideValues
                            ? "***"
                            : compact(Number(payload[0].value))}
                        </Text>
                      </Stack>
                    )
                  }
                />
                <ReferenceLine y={0} stroke={getColor(Colors.danger200)} />
                {snapshot.extraYears > 0 && retirementMonths.length > 0 && (
                  <ReferenceLine
                    x={(retirementMonths[0].month - 1) / 12}
                    stroke={getColor(Colors.neutral400)}
                    strokeDasharray="5 5"
                    label={{
                      value: "Início das retiradas",
                      position: "insideTopLeft",
                      fill: getColor(Colors.neutral400),
                      fontSize: 11,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Patrimônio"
                  stroke={getColor(
                    firstShortfall ? Colors.danger200 : Colors.brand,
                  )}
                  dot={{ r: 2 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              <em>
                Resultado deste aposentado:{" "}
                <span
                  style={{
                    color: getColor(
                      retirementMonths.length === 0
                        ? Colors.neutral400
                        : firstShortfall
                          ? Colors.danger200
                          : Colors.brand,
                    ),
                  }}
                >
                  {retirementMonths.length === 0
                    ? "não iniciou as retiradas antes da idade alvo."
                    : firstShortfall
                      ? `a retirada ficou abaixo dos gastos a partir do mês ${firstShortfall.month}.`
                      : `conseguiu retirar ${money(spending)} em todos os meses da aposentadoria.`}
                </span>{" "}
                Sorteie de novo para ver outra sequência possível.
              </em>
            </Text>
          </>
        )}
        {step >= 2 && (
          <>
            {step === 2 && (
              <>
                <Note>
                  Repetimos a simulação 2.000 vezes para medir em quantos
                  cenários as retiradas cobrem sua despesa mensal até a idade
                  alvo.
                </Note>
                <Note>
                  Cada simulação usa uma nova sequência de meses sorteados e
                  segue as regras do passo anterior. Atingir a meta permite
                  começar as retiradas, mas não garante que elas cubram seus
                  gastos até a idade alvo. O percentual mede essa cobertura nos
                  cenários que começaram as retiradas.
                </Note>
              </>
            )}
            {step === 3 && (
              <>
                <Note>
                  Testamos diferentes patrimônios iniciais para encontrar o
                  menor que permite cobrir seus gastos em pelo menos 95% das
                  simulações.
                </Note>
                <Note>
                  As retiradas começam imediatamente, sem novos aportes.
                  Buscamos um patrimônio inicial que permita cobrir os gastos em
                  pelo menos 95% das simulações. Esta busca não inclui os anos
                  extras de acumulação.
                </Note>
              </>
            )}
            {worker.error ? (
              <Alert severity="error">
                Não foi possível calcular o cenário.{" "}
                <Button
                  size="small"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Tentar novamente
                </Button>
              </Alert>
            ) : !ready ? (
              <Text
                size={FontSizes.EXTRA_SMALL}
                aria-label="Calculando cenário VPW"
              >
                Calculando cenário…
              </Text>
            ) : output ? (
              <>
                {step === 2 && (
                  <>
                    <Text
                      size={FontSizes.EXTRA_SMALL}
                      weight={FontWeights.MEDIUM}
                      color={
                        output.retirement.successRate! >= 0.95
                          ? Colors.brand
                          : Colors.danger200
                      }
                    >
                      {output.retirement.successRate === null
                        ? "Nenhuma sequência iniciou as retiradas"
                        : `${percent(output.retirement.successRate)} de sucesso`}{" "}
                      com {money(wealth)}
                    </Text>
                    <Note>
                      {Math.round(
                        output.retirement.successRate! *
                          output.retirement.trialCount,
                      )}{" "}
                      de {output.retirement.trialCount} simulações cobriram{" "}
                      {money(spending)}/mês até os {snapshot.targetAge} anos.
                      {snapshot.extraYears > 0 &&
                        " Contagem entre as simulações que iniciaram as retiradas."}
                    </Note>
                  </>
                )}
                {step === 2 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={ensemble?.rows ?? []}
                        margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="5" vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke={getColor(Colors.neutral0)}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={getColor(Colors.brand400)}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) =>
                            hideValues ? "***" : compact(value)
                          }
                        />
                        <ReferenceLine
                          y={spending}
                          stroke={getColor(Colors.neutral400)}
                          strokeDasharray="5 5"
                        />
                        {ensemble?.failed.map((failed, index) => (
                          <Line
                            key={index}
                            dataKey={`t${index}`}
                            stroke={getColor(
                              failed ? Colors.danger200 : Colors.brand,
                            )}
                            strokeWidth={1}
                            strokeOpacity={0.25}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    <Note>
                      Cada linha é uma aposentadoria. Verde: cobriu todos os
                      meses. Vermelho: teve alguma retirada abaixo dos gastos.
                      Mostramos as primeiras 100 das 2.000 simulações.
                    </Note>
                  </>
                ) : (
                  <>
                    <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
                      Quanto precisamos hoje para cobrir {money(spending)}/mês
                      até os {snapshot.targetAge} anos?
                    </Text>
                    <Box
                      component="ol"
                      aria-label="Como chegamos à meta VPW"
                      sx={{
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 1.5,
                        alignItems: "stretch",
                      }}
                    >
                      <Box
                        component="li"
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: getColor(Colors.neutral600),
                        }}
                      >
                        <Stack gap={1}>
                          <Text
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral400}
                          >
                            1 · Retiradas desde hoje
                          </Text>
                          <Text
                            size={FontSizes.SMALL}
                            weight={FontWeights.SEMI_BOLD}
                          >
                            {money(spending)}/mês
                          </Text>
                          <Text size={FontSizes.EXTRA_SMALL}>
                            Até os {snapshot.targetAge} anos, sem acumulação
                            antes das retiradas.
                          </Text>
                        </Stack>
                      </Box>
                      <Box
                        component="li"
                        aria-hidden="true"
                        sx={{
                          alignSelf: "center",
                          color: getColor(Colors.neutral400),
                        }}
                      >
                        <Box
                          component="span"
                          sx={{ display: { xs: "none", md: "inline" } }}
                        >
                          →
                        </Box>
                        <Box
                          component="span"
                          sx={{ display: { xs: "inline", md: "none" } }}
                        >
                          ↓
                        </Box>
                      </Box>
                      <Box
                        component="li"
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: getColor(Colors.neutral600),
                        }}
                      >
                        <Stack gap={1}>
                          <Text
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral400}
                          >
                            2 · Critério da meta
                          </Text>
                          <Text
                            size={FontSizes.SMALL}
                            weight={FontWeights.SEMI_BOLD}
                          >
                            Pelo menos 95% das simulações
                          </Text>
                          <Text size={FontSizes.EXTRA_SMALL}>
                            Capital suficiente para 1.900 das 2.000
                            aposentadorias.
                          </Text>
                        </Stack>
                      </Box>
                      <Box
                        component="li"
                        aria-hidden="true"
                        sx={{
                          alignSelf: "center",
                          color: getColor(Colors.neutral400),
                        }}
                      >
                        <Box
                          component="span"
                          sx={{ display: { xs: "none", md: "inline" } }}
                        >
                          →
                        </Box>
                        <Box
                          component="span"
                          sx={{ display: { xs: "inline", md: "none" } }}
                        >
                          ↓
                        </Box>
                      </Box>
                      <Box
                        component="li"
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: getColor(Colors.brand400),
                          bgcolor: getColor(Colors.neutral600),
                        }}
                      >
                        <Stack gap={1}>
                          <Text
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral400}
                          >
                            3 · Meta encontrada
                          </Text>
                          <Text
                            size={FontSizes.SMALL}
                            weight={FontWeights.SEMI_BOLD}
                            color={Colors.brand}
                          >
                            {money(output.targetPatrimony)}
                          </Text>
                        </Stack>
                      </Box>
                    </Box>

                    <Note>
                      O resultado histórico não garante o resultado futuro.
                    </Note>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </Stack>
    </WalkthroughFrame>
  );
}

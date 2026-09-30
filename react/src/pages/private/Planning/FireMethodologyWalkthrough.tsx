import Collapse from "@mui/material/Collapse";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import { DATASET_LABELS } from "./fire/fireHistoricalDatasets";
import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
import {
  prepareWalkthrough,
  type WalkthroughScenario,
  runBinarySearch,
  sampleTrialMonths,
  simulateTrial,
} from "./walkthroughKernel";

import { useHideValues } from "../../../hooks/useHideValues";
import { useFireSimulationWorker } from "../Home/useFireSimulationWorker";
import type { FireStudioSnapshot } from "./fire/fireStudioScenario";

// Four steps explain retirement using the current scenario inputs.

const SOURCE_LINKS: Partial<Record<keyof typeof DATASET_LABELS, string>> = {
  IBOV: "https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/indice-ibovespa-ibovespa-estatisticas-historicas.htm",
  IFIX: "https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/indice-fundos-de-investimentos-imobiliarios-ifix-estatisticas-historicas.htm",
  CDI: "https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=4391&method=consultarGraficoPorId",
  SPY: "https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-spy.xlsx",
  VWRL: "https://www.vanguard.co.uk/professional/product/etf/equity/9505/ftse-all-world-ucits-etf-distributing#prices-and-distribution",
  IMA_S:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-s",
  IRF_M_1:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/irf-m-1",
  IRF_M_1_PLUS:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/irf-m-1-mais",
  IMA_B_5:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-b-5",
  IMA_B_5_PLUS:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-b-5-mais",
  IMA_GERAL_EX_C:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-geral-ex-c",
};
const sourceLabel = (series: keyof typeof DATASET_LABELS) =>
  SOURCE_LINKS[series] ? (
    <Link href={SOURCE_LINKS[series]} target="_blank" rel="noopener noreferrer">
      {DATASET_LABELS[series]}
    </Link>
  ) : (
    DATASET_LABELS[series]
  );

const TRIALS_FOR_ENSEMBLE = 2000;
const ENSEMBLE_RENDERED_LINES = 100;
const formatCurrencyCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const useWalkthroughCurrencyFormatter = () => {
  const { hideValues } = useHideValues();
  return (value: number) => (hideValues ? "***" : formatCurrencyCompact(value));
};

// =============================================================================
// Step 1 — Deck of historical years
// =============================================================================

const formatMonth = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

const DeckStep = ({ scenario }: { scenario: WalkthroughScenario }) => {
  const [seed, setSeed] = useState(1);
  const months = useMemo(
    () => sampleTrialMonths(seed, scenario),
    [seed, scenario],
  );
  const blocks =
    scenario.snapshot.samplingMethod === "contiguous_12_month_blocks";
  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Sorteamos meses do histórico da sua carteira para montar uma sequência
        de retornos ao longo dos anos do seu cenário. Um mesmo mês pode aparecer
        mais de uma vez.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        {blocks
          ? "Sorteamos blocos de 12 meses consecutivos."
          : "Sorteamos cada mês de forma independente."}{" "}
        Todos os ativos usam o mesmo mês histórico, preservando a relação entre
        seus retornos.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL}>Primeiros 24 meses sorteados</Text>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {months.slice(0, 24).map((month, index) => (
          <Stack
            key={index}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: "1px solid",
              borderColor: getColor(Colors.brand),
            }}
          >
            <Text size={FontSizes.EXTRA_SMALL}>{formatMonth(month)}</Text>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row">
        <Button
          variant="outlined"
          size="small"
          onClick={() => setSeed((value) => value + 1)}
        >
          Sortear de novo
        </Button>
      </Stack>
    </Stack>
  );
};

// =============================================================================
// Step 2 — One simulated retiree
// =============================================================================

const SingleTrialStep = ({ scenario }: { scenario: WalkthroughScenario }) => {
  const formatCurrencyCompact = useWalkthroughCurrencyFormatter();
  const { targetYears: horizon } = scenario.snapshot;
  const [seed, setSeed] = useState(7);
  const trial = useMemo(() => simulateTrial(seed, scenario), [seed, scenario]);

  const data = trial.balances.map((bal, year) => ({
    year,
    balance: bal,
    yearReturn: year === 0 ? null : trial.yearReturns[year - 1],
  }));

  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Aplicamos os retornos sorteados ao patrimônio e descontamos sua despesa
        mensal para ver se o dinheiro dura até a idade alvo.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        As retiradas começam agora, sem novos aportes. Os pesos da carteira
        permanecem fixos. Os valores descontam a inflação.
      </Text>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          onClick={() => setSeed((s) => s + 1)}
        >
          Sortear nova sequência
        </Button>
      </Stack>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 5, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="5" vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[0, horizon]}
            ticks={Array.from(
              { length: Math.min(6, horizon + 1) },
              (_, index) =>
                Math.round((index * horizon) / Math.min(5, horizon)),
            )}
            minTickGap={30}
            stroke={getColor(Colors.neutral0)}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "Ano da aposentadoria",
              position: "insideBottom",
              offset: -10,
              fill: getColor(Colors.neutral400),
              fontSize: 11,
            }}
          />
          <YAxis
            stroke={getColor(Colors.brand400)}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrencyCompact(v)}
          />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
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
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                    Ano {d.year}
                  </Text>
                  {d.yearReturn !== null && (
                    <Text
                      size={FontSizes.EXTRA_SMALL}
                      color={
                        d.yearReturn >= 0 ? Colors.brand : Colors.danger200
                      }
                    >
                      Retorno dos 12 meses sorteados:{" "}
                      {d.yearReturn >= 0 ? "+" : ""}
                      {(d.yearReturn * 100).toFixed(1)}%
                    </Text>
                  )}
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.brand200}>
                    Saldo: {formatCurrencyCompact(d.balance)}
                  </Text>
                </Stack>
              );
            }}
          />
          <ReferenceLine y={0} stroke={getColor(Colors.danger200)} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={getColor(trial.busted ? Colors.danger200 : Colors.brand)}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          Resultado deste aposentado:{" "}
          {trial.busted ? (
            <span style={{ color: getColor(Colors.danger200) }}>
              esgotou o patrimônio durante os {horizon} anos.
            </span>
          ) : (
            <span style={{ color: getColor(Colors.brand) }}>
              sobreviveu até o fim com saldo final{" "}
              {formatCurrencyCompact(trial.balances[horizon])}.
            </span>
          )}{" "}
          Sorteie de novo para ver outra sequência possível.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Step 3 — 2000 retirees at once
// =============================================================================

const EnsembleStep = ({ scenario }: { scenario: WalkthroughScenario }) => {
  const formatCurrencyCompact = useWalkthroughCurrencyFormatter();
  const { targetYears: horizon } = scenario.snapshot;
  const advanced =
    scenario.snapshot.showAgeInBonds ||
    (scenario.snapshot.extraAccumulationYears ?? 0) > 0;
  const production = useFireSimulationWorker(
    advanced ? scenario.snapshot.request : null,
  );
  const productionOutput = production.result?.output;
  const extended = productionOutput?.extendedAccumulation;
  const productionBootstrap =
    production.result?.kind === "constant_dollar"
      ? production.result.output.bootstrap
      : production.result?.output.lifestyleBootstrap;
  const [seedBase, setSeedBase] = useState(100);

  const requestKey = `${seedBase}:${JSON.stringify(scenario.snapshot)}`;
  const [result, setResult] = useState<{
    key: string;
    trials: ReturnType<typeof simulateTrial>[];
  } | null>(null);
  const isCalculating = advanced
    ? production.isCalculating
    : result?.key !== requestKey;
  const trials = useMemo(
    () => (isCalculating ? [] : (result?.trials ?? [])),
    [isCalculating, result],
  );

  useEffect(() => {
    if (advanced) return;
    const nextTrials: ReturnType<typeof simulateTrial>[] = [];
    // Yield between batches so loading feedback paints and controls stay responsive.
    const calculateBatch = () => {
      const end = Math.min(nextTrials.length + 25, TRIALS_FOR_ENSEMBLE);
      while (nextTrials.length < end) {
        nextTrials.push(simulateTrial(seedBase + nextTrials.length, scenario));
      }
      if (nextTrials.length === TRIALS_FOR_ENSEMBLE) {
        setResult({ key: requestKey, trials: nextTrials });
      } else {
        timer = setTimeout(calculateBatch, 0);
      }
    };
    let timer = setTimeout(calculateBatch, 0);
    return () => clearTimeout(timer);
  }, [seedBase, scenario, requestKey, advanced]);

  const trialCount = advanced
    ? (extended?.retirementTrialCount ?? TRIALS_FOR_ENSEMBLE)
    : TRIALS_FOR_ENSEMBLE;
  const survivors = advanced
    ? Math.round((productionBootstrap?.successRate ?? 0) * trialCount)
    : trials.filter((t) => !t.busted).length;
  const renderedTrials = useMemo(
    () => trials.slice(0, ENSEMBLE_RENDERED_LINES),
    [trials],
  );

  const chartData = useMemo(() => {
    const rows: Record<string, number>[] = [];
    for (let year = 0; year <= horizon; year++) {
      const row: Record<string, number> = { year };
      renderedTrials.forEach((t, i) => {
        row[`t${i}`] = t.balances[year];
      });
      rows.push(row);
    }
    return rows;
  }, [renderedTrials, horizon]);

  const passes = trialCount > 0 && survivors / trialCount >= 0.9;

  return (
    <Stack gap={1.5} aria-busy={isCalculating}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Repetimos a simulação 2.000 vezes para medir em quantos cenários o
        patrimônio sustenta sua despesa mensal até a idade alvo.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Cada simulação usa uma nova sequência de meses sorteados e segue as
        regras do passo anterior. Atingir a meta permite começar as retiradas,
        mas não garante que elas cubram seus gastos até a idade alvo. O
        percentual mede essa cobertura nos cenários que começaram as retiradas.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        {advanced
          ? "O conjunto inclui os anos extras de acumulação e a alocação por idade quando configurados. O gráfico mostra os percentis 10, 50 e 90 do saldo."
          : "O gráfico mostra as primeiras 100 das 2.000 simulações."}
      </Text>
      {!advanced && (
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            disabled={isCalculating}
            onClick={() => setSeedBase((s) => s + TRIALS_FOR_ENSEMBLE)}
          >
            Sortear nova rodada
          </Button>
        </Stack>
      )}
      {advanced && extended && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {extended.retirementTrialCount} de 2.000 cenários iniciaram a
          aposentadoria após a acumulação. O sucesso abaixo considera apenas
          esses cenários; os demais não atingiram a meta no prazo simulado.
        </Text>
      )}
      {advanced && (production.error || !scenario.snapshot.request) ? (
        <Text size={FontSizes.EXTRA_SMALL}>
          Não foi possível calcular o cenário completo. Confira os dados do
          plano.
        </Text>
      ) : isCalculating ? (
        <Stack gap={1.5} aria-label="Calculando simulação">
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="text" width="75%" />
        </Stack>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={advanced ? (productionBootstrap?.bands ?? []) : chartData}
              margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="5" vertical={false} />
              <XAxis
                dataKey="year"
                stroke={getColor(Colors.neutral0)}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                stroke={getColor(Colors.brand400)}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)}
              />
              <ReferenceLine y={0} stroke={getColor(Colors.danger200)} />
              {advanced
                ? ["p10", "p50", "p90"].map((key) => (
                    <Line
                      key={key}
                      name={key.toUpperCase()}
                      dataKey={key}
                      stroke={getColor(
                        key === "p50" ? Colors.brand : Colors.brand400,
                      )}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))
                : renderedTrials.map((t, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`t${i}`}
                      stroke={getColor(
                        t.busted ? Colors.danger200 : Colors.brand,
                      )}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
            </LineChart>
          </ResponsiveContainer>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={passes ? Colors.brand : Colors.danger200}
            weight={FontWeights.MEDIUM}
          >
            {survivors} / {trialCount} sobreviveram{" "}
            {advanced
              ? "às despesas do plano"
              : `à taxa de ${(((scenario.snapshot.monthlyExpenses * 12) / scenario.snapshot.effectivePatrimony) * 100).toFixed(1)}%`}{" "}
            durante {horizon} anos → {passes ? "passa" : "não passa"} no
            critério de 90% de sucesso.
          </Text>
        </>
      )}
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          No próximo passo, a busca testa taxas de retirada para encontrar a
          maior que passa em 90% dos 2.000 cenários, usando a carteira e o
          horizonte selecionados.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Step 4 — Binary search animation
// =============================================================================

const SearchStep = ({ scenario }: { scenario: WalkthroughScenario }) => {
  const production = useFireSimulationWorker(
    scenario.snapshot.showAgeInBonds ? scenario.snapshot.request : null,
  );
  if (scenario.snapshot.showAgeInBonds) {
    if (production.error || !scenario.snapshot.request)
      return (
        <Text size={FontSizes.EXTRA_SMALL}>
          Informe a idade para calcular a taxa desta estratégia.
        </Text>
      );
    if (production.isCalculating || production.result?.kind !== "age_in_bonds")
      return (
        <Skeleton
          aria-label="Calculando taxa segura"
          variant="rounded"
          height={220}
        />
      );
    return (
      <SearchAnimation
        scenario={scenario}
        anchorAge={production.result.output.solverState.anchorAge}
      />
    );
  }
  return <SearchAnimation scenario={scenario} />;
};

const SearchAnimation = ({
  scenario,
  anchorAge,
}: {
  scenario: WalkthroughScenario;
  anchorAge?: number;
}) => {
  const iterations = useMemo(
    () => runBinarySearch(scenario, anchorAge),
    [scenario, anchorAge],
  );
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [scenario]);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= iterations.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 600);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, iterations.length]);

  const current = iterations[step];
  const lastIter = iterations[iterations.length - 1];
  const finalSafeRate = lastIter.passes ? lastIter.mid : lastIter.lo;

  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Testamos diferentes taxas de retirada para encontrar a maior que
        sustenta os gastos em pelo menos 90% das simulações.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        As retiradas começam imediatamente, sem novos aportes. Buscamos uma taxa
        que sustente os gastos em pelo menos 90% das simulações. Esta busca não
        inclui os anos extras de acumulação.
      </Text>

      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
        >
          ▶ Rodar busca
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setPlaying(false);
            setStep(iterations.length - 1);
          }}
        >
          Pular para o fim
        </Button>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Rodada {current.iter + 1} de {iterations.length}
        </Text>
      </Stack>

      <Stack
        sx={{
          position: "relative",
          height: 60,
          backgroundColor: getColor(Colors.neutral600),
          borderRadius: 1,
          mx: 2,
        }}
      >
        <Stack
          sx={{
            position: "absolute",
            left: `${(current.lo / 0.1) * 100}%`,
            width: `${((current.hi - current.lo) / 0.1) * 100}%`,
            top: 16,
            bottom: 16,
            backgroundColor: getColor(Colors.brand400),
            borderRadius: 1,
          }}
        />
        <Stack
          sx={{
            position: "absolute",
            left: `${(current.mid / 0.1) * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: getColor(
              current.passes ? Colors.brand : Colors.danger200,
            ),
            transform: "translateX(-1px)",
          }}
        />
        {[0, 0.025, 0.05, 0.075, 0.1].map((tick) => (
          <Stack
            key={tick}
            sx={{
              position: "absolute",
              left: `${(tick / 0.1) * 100}%`,
              bottom: -2,
              transform: "translateX(-50%)",
            }}
          >
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              {(tick * 100).toFixed(1)}%
            </Text>
          </Stack>
        ))}
      </Stack>

      <Stack
        direction="row"
        gap={2}
        flexWrap="wrap"
        sx={{ mt: 2, fontSize: 12 }}
      >
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Faixa: <strong>{(current.lo * 100).toFixed(2)}%</strong> –{" "}
          <strong>{(current.hi * 100).toFixed(2)}%</strong>
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Testando: <strong>{(current.mid * 100).toFixed(2)}%</strong>
        </Text>
        <Text
          size={FontSizes.EXTRA_SMALL}
          color={current.passes ? Colors.brand : Colors.danger200}
          weight={FontWeights.MEDIUM}
        >
          Sucesso: {(current.successRate * 100).toFixed(1)}% →{" "}
          {current.passes ? "passa, sobe o piso" : "falha, baixa o teto"}
        </Text>
      </Stack>

      {step === iterations.length - 1 && (
        <Text
          size={FontSizes.SMALL}
          color={Colors.brand}
          weight={FontWeights.SEMI_BOLD}
        >
          Taxa segura encontrada: {(finalSafeRate * 100).toFixed(2)}% a.a.
        </Text>
      )}
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          {anchorAge === undefined
            ? "Esta taxa usa os pesos atuais da carteira."
            : `Esta taxa usa a alocação por idade a partir de ${anchorAge} anos, a idade de referência calculada pelo motor do plano.`}{" "}
          Os históricos e o modo de sorteio são os selecionados. Um horizonte
          maior tende a exigir uma taxa menor, mas não existe uma regra que a
          obrigue a ficar abaixo de 4%. O critério de 90% descreve os cenários
          simulados; não é uma garantia de sucesso futuro.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Wrapper — horizontal stepper and current scenario context
// =============================================================================

const STEP_LABELS = [
  "Sorteando meses históricos",
  "Um aposentado simulado",
  "2000 aposentados ao mesmo tempo",
  "Procurando a taxa segura",
] as const;

const FireMethodologyWalkthrough = ({
  snapshot,
}: {
  snapshot: FireStudioSnapshot;
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const snapshotKey = JSON.stringify(snapshot);
  const preparation = useMemo(() => {
    if (
      snapshot.effectivePatrimony <= 0 ||
      snapshot.targetYears <= 0 ||
      !snapshot.portfolio.length
    )
      return {
        scenario: null,
        error:
          "Defina um patrimônio positivo, uma carteira e um horizonte para acompanhar os passos.",
      };
    try {
      return { scenario: prepareWalkthrough(snapshot), error: null };
    } catch {
      return {
        scenario: null,
        error:
          "Os históricos selecionados não oferecem meses suficientes para este modo de sorteio.",
      };
    }
  }, [snapshot]);
  const { scenario } = preparation;

  const renderStepContent = (idx: number) => {
    if (!scenario)
      return <Text size={FontSizes.EXTRA_SMALL}>{preparation.error}</Text>;
    switch (idx) {
      case 0:
        return <DeckStep scenario={scenario} />;
      case 1:
        return <SingleTrialStep scenario={scenario} />;
      case 2:
        return <EnsembleStep scenario={scenario} />;
      case 3:
        return <SearchStep scenario={scenario} />;
      default:
        return null;
    }
  };

  return (
    <Stack gap={3}>
      <Stack gap={0.5}>
        <Text size={FontSizes.MEDIUM} weight={FontWeights.SEMI_BOLD}>
          Como achamos a taxa segura
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Os 4 passos mostram como sua carteira e seu cenário são usados para
          encontrar a taxa segura.
        </Text>
      </Stack>
      <Stack gap={1}>
        <Button
          variant="brand-text"
          size="small"
          sx={{ alignSelf: "flex-start" }}
          aria-expanded={sourcesExpanded}
          aria-controls="fire-walkthrough-sources"
          endIcon={sourcesExpanded ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setSourcesExpanded((value) => !value)}
        >
          Fontes da simulação
        </Button>
        <Collapse in={sourcesExpanded} id="fire-walkthrough-sources">
          <Stack gap={1}>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Históricos selecionados:{" "}
              {[...snapshot.portfolio]
                .sort((a, b) => b.weight - a.weight)
                .map((slice, index) => (
                  <span key={`${slice.series}-${index}`}>
                    {index > 0 && " · "}
                    {(slice.weight * 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    % {sourceLabel(slice.series)}
                    {slice.fallbackSeries && (
                      <>
                        {" "}
                        (complementado por {sourceLabel(slice.fallbackSeries)})
                      </>
                    )}
                  </span>
                ))}
              .
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Inflação:{" "}
              <Link
                href="https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=433&method=consultarGraficoPorId"
                target="_blank"
                rel="noopener noreferrer"
              >
                IPCA (BCB SGS 433)
              </Link>
              .
            </Text>
          </Stack>
        </Collapse>
      </Stack>

      <Stepper activeStep={activeStep} alternativeLabel nonLinear>
        {STEP_LABELS.map((label, idx) => (
          <Step key={label} active={activeStep === idx}>
            <StepLabel
              onClick={() => setActiveStep(idx)}
              sx={{ cursor: "pointer" }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Stack
        gap={2}
        sx={{
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: getColor(Colors.neutral400),
        }}
      >
        <Stack key={snapshotKey}>{renderStepContent(activeStep)}</Stack>
        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            disabled={activeStep === 0}
          >
            Voltar
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() =>
              setActiveStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))
            }
            disabled={activeStep === STEP_LABELS.length - 1}
          >
            Próximo
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default FireMethodologyWalkthrough;

import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Link from "@mui/material/Link";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { SamplingMethod } from "../Home/fireReturnTypes";
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
  DEFAULT_HORIZON,
  EXAMPLE_EQUITY_WEIGHT,
  EXAMPLE_FI_WEIGHT,
  HORIZON_MAX,
  HORIZON_MIN,
  EXAMPLE_MONTHS,
  runBinarySearch,
  sampleTrialMonths,
  simulateTrial,
} from "./walkthroughKernel";

// Four interactive steps using a fixed example portfolio and monthly returns.

const TRIALS_FOR_ENSEMBLE = 1000;
const ENSEMBLE_RENDERED_LINES = 100;
const TRIALS_PER_SEARCH_TEST_DISPLAY = 1000;
const RATE_MIN = 0.02;
const RATE_MAX = 0.06;
const RATE_STEP = 0.005;

// Which (zero-indexed) steps use the `taxa` slider. Off-list steps disable it.
const RATE_RELEVANT_STEPS = new Set([1, 2]);

const formatCurrencyCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};

// =============================================================================
// Step 1 — Deck of historical years
// =============================================================================

const formatMonth = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

const DeckStep = ({
  horizon,
  method,
}: {
  horizon: number;
  method: SamplingMethod;
}) => {
  const [seed, setSeed] = useState(1);
  const months = useMemo(
    () => sampleTrialMonths(seed, horizon, method),
    [seed, horizon, method],
  );
  const blocks = method === "contiguous_12_month_blocks";
  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        O exemplo usa {EXAMPLE_MONTHS.length} meses comuns ao IBOV e CDI, de{" "}
        {formatMonth(EXAMPLE_MONTHS[0])} a{" "}
        {formatMonth(EXAMPLE_MONTHS[EXAMPLE_MONTHS.length - 1])}. Para {horizon}{" "}
        anos de aposentadoria, sorteamos {horizon * 12} meses com reposição: um
        mesmo mês pode aparecer várias vezes.
      </Text>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        {blocks
          ? "Preservando sequências, cada sorteio traz 12 meses consecutivos. O bloco pode começar em qualquer mês, não apenas em janeiro."
          : "Sem preservar sequências, cada mês é sorteado independentemente; a ordem histórica entre meses não é mantida."}{" "}
        Todas as classes usam o mesmo mês sorteado, preservando a relação entre
        seus retornos naquele mês.
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
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Na sua simulação, cada subgrupo usa o histórico configurado. Um
        complemento fornece os meses anteriores ao início do principal; depois,
        vale o principal. O período disponível contém apenas meses cobertos por
        todos os grupos que exigem histórico. Por isso, um complemento pode não
        ampliar o período se outro grupo começar mais tarde.
      </Text>
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

const SingleTrialStep = ({
  rate,
  horizon,
  method,
}: {
  rate: number;
  horizon: number;
  method: SamplingMethod;
}) => {
  const [seed, setSeed] = useState(7);
  const trial = useMemo(
    () => simulateTrial(rate, seed, horizon, method),
    [rate, seed, horizon, method],
  );

  const data = trial.balances.map((bal, year) => ({
    year,
    balance: bal,
    yearReturn: year === 0 ? null : trial.yearReturns[year - 1],
  }));

  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Este exemplo começa na aposentadoria, com <strong>R$ 1 milhão</strong>:{" "}
        {EXAMPLE_EQUITY_WEIGHT * 100}% IBOV e {EXAMPLE_FI_WEIGHT * 100}% CDI. A
        retirada anual de <strong>{(rate * 100).toFixed(1)}%</strong> do
        patrimônio inicial é dividida em 12 parcelas mensais constantes em poder
        de compra. A cada mês, aplicamos o retorno real ponderado da carteira e
        depois descontamos a retirada. Não há novos aportes durante a
        aposentadoria. O gráfico mostra o saldo ao fim de cada ano.
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
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="5" vertical={false} />
          <XAxis
            dataKey="year"
            stroke={getColor(Colors.neutral0)}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "Ano da aposentadoria",
              position: "insideBottom",
              offset: -5,
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
      <Stack
        gap={0.5}
        sx={{
          mt: 1,
          p: 1.5,
          borderRadius: 1,
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <Text
          size={FontSizes.EXTRA_SMALL}
          color={Colors.neutral200}
          weight={FontWeights.MEDIUM}
        >
          Fontes da simulação
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Renda variável BR:{" "}
          <Link
            href="https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            IBOV
          </Link>
          . Renda variável EUA, global e cripto usam o proxy selecionado em
          Dados históricos.
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          FIIs:{" "}
          <Link
            href="https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/indice-de-fundos-de-investimentos-imobiliarios-ifix.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            IFIX
          </Link>{" "}
          (B3).
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Renda fixa BR usa o histórico selecionado para seu subgrupo; a seleção
          inicial considera o indexador e o vencimento do ativo. O CDI vem do{" "}
          <Link
            href="https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=4391&method=consultarGraficoPorId"
            target="_blank"
            rel="noopener noreferrer"
          >
            CDI acumulado no mês
          </Link>{" "}
          (BCB SGS 4391).
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Inflação para deflacionar tudo a valores reais:{" "}
          <Link
            href="https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.paint?method=consultarValores"
            target="_blank"
            rel="noopener noreferrer"
          >
            IPCA (BCB SGS 433)
          </Link>
          .
        </Text>
      </Stack>
    </Stack>
  );
};

// =============================================================================
// Step 3 — 1000 retirees at once
// =============================================================================

const EnsembleStep = ({
  rate,
  horizon,
  method,
}: {
  rate: number;
  horizon: number;
  method: SamplingMethod;
}) => {
  const [seedBase, setSeedBase] = useState(100);

  const requestKey = `${seedBase}:${rate}:${horizon}:${method}`;
  const [result, setResult] = useState<{
    key: string;
    trials: ReturnType<typeof simulateTrial>[];
  } | null>(null);
  const isCalculating = result?.key !== requestKey;
  const trials = useMemo(
    () => (isCalculating ? [] : (result?.trials ?? [])),
    [isCalculating, result],
  );

  useEffect(() => {
    const nextTrials: ReturnType<typeof simulateTrial>[] = [];
    // Yield between batches so loading feedback paints and controls stay responsive.
    const calculateBatch = () => {
      const end = Math.min(nextTrials.length + 25, TRIALS_FOR_ENSEMBLE);
      while (nextTrials.length < end) {
        nextTrials.push(
          simulateTrial(rate, seedBase + nextTrials.length, horizon, method),
        );
      }
      if (nextTrials.length === TRIALS_FOR_ENSEMBLE) {
        setResult({ key: requestKey, trials: nextTrials });
      } else {
        timer = setTimeout(calculateBatch, 0);
      }
    };
    let timer = setTimeout(calculateBatch, 0);
    return () => clearTimeout(timer);
  }, [seedBase, rate, horizon, method, requestKey]);

  const survivors = trials.filter((t) => !t.busted).length;
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

  const passes = survivors / TRIALS_FOR_ENSEMBLE >= 0.9;

  return (
    <Stack gap={1.5} aria-busy={isCalculating}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Cada cenário sorteia sua própria sequência de {horizon * 12} meses.
        Retornos ruins no começo das retiradas podem esgotar o patrimônio mais
        cedo. Aqui calculamos {TRIALS_FOR_ENSEMBLE} cenários e desenhamos os
        primeiros {ENSEMBLE_RENDERED_LINES} para manter o gráfico legível. A
        busca da taxa também usa 1.000 cenários por teste; os resultados do
        plano usam 2.000.
      </Text>
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
      {isCalculating ? (
        <Stack gap={1.5} aria-label="Calculando simulação">
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="text" width="75%" />
        </Stack>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
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
              {renderedTrials.map((t, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`t${i}`}
                  stroke={getColor(t.busted ? Colors.danger200 : Colors.brand)}
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
            {survivors} / {TRIALS_FOR_ENSEMBLE} sobreviveram à taxa de{" "}
            {(rate * 100).toFixed(1)}% durante {horizon} anos →{" "}
            {passes ? "passa" : "não passa"} no critério de 90% de sucesso.
          </Text>
        </>
      )}
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          A taxa segura é a maior taxa que ainda passa em pelo menos 90% dos{" "}
          {TRIALS_FOR_ENSEMBLE} — é o que o algoritmo busca no próximo passo.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Step 4 — Binary search animation
// =============================================================================

const SearchStep = ({
  horizon,
  method,
}: {
  horizon: number;
  method: SamplingMethod;
}) => {
  const iterations = useMemo(
    () => runBinarySearch(horizon, method),
    [horizon, method],
  );
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [horizon, method]);

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
        Para achar a maior taxa que ainda passa em 90%, o algoritmo faz uma
        busca binária. Começa com um intervalo amplo (0,5% a 10%) e a cada
        rodada testa o ponto médio com {TRIALS_PER_SEARCH_TEST_DISPLAY}{" "}
        aposentados. Se o meio passa, o limite inferior sobe. Se falha, o limite
        superior desce. Após 20 rodadas, o intervalo fecha sobre a taxa
        estimada. Reutilizamos os mesmos sorteios em cada rodada para comparar
        as taxas sob as mesmas condições.
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
          Esta taxa pertence à carteira de exemplo e ao horizonte escolhido. Na
          sua simulação, ela depende dos pesos, dos históricos e do modo de
          sorteio configurados. Um horizonte maior tende a exigir uma taxa
          menor, mas não existe uma regra que a obrigue a ficar abaixo de 4%. O
          critério de 90% descreve os cenários simulados; não é uma garantia de
          sucesso futuro.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Wrapper — horizontal stepper + shared header sliders
// =============================================================================

const STEP_LABELS = [
  "Sorteando meses históricos",
  "Um aposentado simulado",
  "1000 aposentados ao mesmo tempo",
  "Procurando a taxa segura",
] as const;

const FireMethodologyWalkthrough = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [rate, setRate] = useState(0.04);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const [method, setMethod] = useState<SamplingMethod>("independent_months");
  const rateActive = RATE_RELEVANT_STEPS.has(activeStep);

  const renderStepContent = (idx: number) => {
    switch (idx) {
      case 0:
        return <DeckStep horizon={horizon} method={method} />;
      case 1:
        return (
          <SingleTrialStep rate={rate} horizon={horizon} method={method} />
        );
      case 2:
        return <EnsembleStep rate={rate} horizon={horizon} method={method} />;
      case 3:
        return <SearchStep horizon={horizon} method={method} />;
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
          Os 4 passos abaixo mostram, em uma carteira de exemplo (R$ 1M em 70%
          IBOV + 30% CDI), como a taxa segura é encontrada via bootstrap
          histórico. Estes controles alteram apenas o exemplo, não o seu plano.
        </Text>
      </Stack>

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={3}
        sx={{
          p: 1.5,
          borderRadius: 1,
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <Stack gap={0.5}>
          <Text
            size={FontSizes.EXTRA_SMALL}
            color={rateActive ? Colors.neutral200 : Colors.neutral400}
          >
            Taxa de retirada anual: <strong>{(rate * 100).toFixed(1)}%</strong>
            {!rateActive && (
              <em style={{ color: getColor(Colors.neutral400) }}>
                {" "}
                (não usado neste passo)
              </em>
            )}
          </Text>
          <Slider
            value={rate}
            onChange={(_, v) => setRate(v as number)}
            min={RATE_MIN}
            max={RATE_MAX}
            step={RATE_STEP}
            size="small"
            sx={{ width: 220 }}
            disabled={!rateActive}
            aria-label="Taxa de retirada anual"
            getAriaValueText={(v) => `${(v * 100).toFixed(1)} por cento`}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${(v * 100).toFixed(1)}%`}
          />
        </Stack>
        <Stack gap={0.5}>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral200}>
            Horizonte: <strong>{horizon} anos</strong>
          </Text>
          <Slider
            value={horizon}
            onChange={(_, v) => setHorizon(v as number)}
            min={HORIZON_MIN}
            max={HORIZON_MAX}
            step={5}
            marks
            size="small"
            sx={{ width: 220 }}
            aria-label="Horizonte de aposentadoria em anos"
            getAriaValueText={(v) => `${v} anos`}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v} anos`}
          />
        </Stack>
      </Stack>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={method === "contiguous_12_month_blocks"}
            onChange={(_, checked) =>
              setMethod(
                checked ? "contiguous_12_month_blocks" : "independent_months",
              )
            }
          />
        }
        label={
          <Text size={FontSizes.EXTRA_SMALL}>
            Preservar sequências históricas de 12 meses
          </Text>
        }
      />
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        O horizonte começa na aposentadoria. Os aportes pertencem à fase de
        acumulação. Com anos extras de acumulação, após atingir a meta FIRE o
        plano continua recebendo aportes pelo período configurado antes das
        retiradas. O patrimônio projetado nesse momento passa a financiar a
        aposentadoria; o alcance da meta é verificado ao fim de cada ano. Na
        opção Idade em Renda Fixa, a alocação também muda com a idade. Este
        exemplo mantém os pesos fixos.
      </Text>

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
        {renderStepContent(activeStep)}
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

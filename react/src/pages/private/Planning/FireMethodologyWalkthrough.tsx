import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Slider from "@mui/material/Slider";
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
import { FIRE_RETURNS_YEARS } from "../Home/fireReturns";
import {
  DEFAULT_HORIZON,
  EXAMPLE_EQUITY_WEIGHT,
  EXAMPLE_FI_WEIGHT,
  HORIZON_MAX,
  HORIZON_MIN,
  drawYearReturn,
  runBinarySearch,
  sampleTrialYears,
  simulateTrial,
} from "./walkthroughKernel";

// =============================================================================
// Horizontal-stepper walkthrough showing how the safe withdrawal rate (SWR)
// is found via bootstrap. Four steps: deck of historical years → one
// simulated retiree → 1000 retirees at once → binary search for the rate.
// Shared `taxa` + `horizonte` sliders live in the header and disable on
// steps that don't read them. Rendered from the FIRE explanation panels.
// =============================================================================

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

const DeckStep = ({ horizon }: { horizon: number }) => {
  const [seed, setSeed] = useState(1);
  const drawnIndices = useMemo(
    () => sampleTrialYears(seed, horizon),
    [seed, horizon],
  );
  const drawCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const idx of drawnIndices) {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    return counts;
  }, [drawnIndices]);

  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Imagine um baralho com {FIRE_RETURNS_YEARS.length} cartas, uma para
        cada ano histórico de 2001 a 2025. Para simular {horizon} anos de
        aposentadoria, sorteamos {horizon} cartas com reposição (a mesma
        carta pode sair várias vezes, outras podem nem sair). É o que
        chamamos de bootstrap.
      </Text>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {FIRE_RETURNS_YEARS.map((year, idx) => {
          const count = drawCounts.get(idx) ?? 0;
          const drawn = count > 0;
          return (
            <Stack
              key={year}
              alignItems="center"
              justifyContent="center"
              sx={{
                minWidth: 48,
                py: 0.5,
                px: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: drawn
                  ? getColor(Colors.brand)
                  : getColor(Colors.neutral400),
                backgroundColor: drawn
                  ? getColor(Colors.brand400)
                  : "transparent",
              }}
            >
              <Text
                size={FontSizes.EXTRA_SMALL}
                color={drawn ? Colors.neutral0 : Colors.neutral400}
                weight={drawn ? FontWeights.SEMI_BOLD : undefined}
              >
                {year}
              </Text>
              {count > 1 && (
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral0}>
                  ×{count}
                </Text>
              )}
            </Stack>
          );
        })}
      </Stack>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          Esta é uma jogada de exemplo: {drawnIndices.length} cartas
          sorteadas, {drawCounts.size} anos distintos cobertos.
        </em>
      </Text>
      <Stack direction="row" gap={1}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setSeed((s) => s + 1)}
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
}: {
  rate: number;
  horizon: number;
}) => {
  const [seed, setSeed] = useState(7);
  const trial = useMemo(
    () => simulateTrial(rate, seed, horizon),
    [rate, seed, horizon],
  );

  const data = trial.balances.map((bal, year) => ({
    year,
    balance: bal,
    historicalYear:
      year === 0
        ? null
        : FIRE_RETURNS_YEARS[trial.yearIndices[year - 1]],
    yearReturn:
      year === 0 ? null : drawYearReturn(trial.yearIndices[year - 1]),
  }));

  return (
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Agora, separamos seus ativos por tipo e comparamos com o histórico* de cada
        um para simular como o patrimônio de alguém aposentado, retirando a
        uma taxa de <strong>{(rate * 100).toFixed(1)}%</strong> ao ano,
        flutuaria ao longo dos anos. Abaixo, simulamos um aposentado com{" "}
        <strong>R$ 1M</strong> em patrimônio, com{" "}
        {(EXAMPLE_EQUITY_WEIGHT * 100).toFixed(0)}% em ações e{" "}
        {(EXAMPLE_FI_WEIGHT * 100).toFixed(0)}% em renda fixa.
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
        <LineChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
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
                    {d.historicalYear !== null && (
                      <> · sorteado: {d.historicalYear}</>
                    )}
                  </Text>
                  {d.yearReturn !== null && (
                    <Text
                      size={FontSizes.EXTRA_SMALL}
                      color={
                        d.yearReturn >= 0 ? Colors.brand : Colors.danger200
                      }
                    >
                      Retorno do ano: {d.yearReturn >= 0 ? "+" : ""}
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
              quebrou antes de chegar ao ano {horizon}.
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
          * Fontes históricas
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Ações BR:{" "}
          <Link
            href="https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            IBOV
          </Link>
          , 1995–2025. Ações EUA e Cripto entram nesse mesmo balde por
          simplificação.
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
          (B3), 2011–2025.
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Renda fixa BR:{" "}
          <Link
            href="https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=4391&method=consultarGraficoPorId"
            target="_blank"
            rel="noopener noreferrer"
          >
            CDI acumulado no mês
          </Link>{" "}
          (BCB SGS 4391), 1995–2025.
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
}: {
  rate: number;
  horizon: number;
}) => {
  const [seedBase, setSeedBase] = useState(100);

  const trials = useMemo(
    () =>
      Array.from({ length: TRIALS_FOR_ENSEMBLE }, (_, i) =>
        simulateTrial(rate, seedBase + i, horizon),
      ),
    [seedBase, rate, horizon],
  );

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
    <Stack gap={1.5}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Cada aposentado sorteia sua própria sequência de {horizon} anos a
        partir do mesmo baralho. Os que sortearem anos ruins cedo (ex.: 2008
        logo no começo) tendem a quebrar; os que sortearem anos bons cedo
        chegam ao fim com folga. Repetimos {TRIALS_FOR_ENSEMBLE} aposentados
        a uma mesma taxa para ver a distribuição.
      </Text>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          onClick={() => setSeedBase((s) => s + TRIALS_FOR_ENSEMBLE)}
        >
          Sortear nova rodada
        </Button>
      </Stack>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
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
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        <em>
          A taxa segura é a maior taxa que ainda passa em pelo menos 90% dos
          {" "}{TRIALS_FOR_ENSEMBLE} — é o que o algoritmo busca no próximo
          passo.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Step 4 — Binary search animation
// =============================================================================

const SearchStep = ({ horizon }: { horizon: number }) => {
  const [seedBase] = useState(50_000);
  const iterations = useMemo(
    () => runBinarySearch(seedBase, horizon),
    [seedBase, horizon],
  );
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [horizon]);

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
        aposentados. Se o meio passa, o limite inferior sobe. Se falha, o
        limite superior desce. Após 20 rodadas, o intervalo fecha sobre a
        taxa segura.
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
          Essa é a taxa segura para o seu horizonte. Em horizontes longos
          (&gt; 30 anos) ela fica menor que a clássica 4% — e é por isso que
          a meta acima exige mais que 25× das despesas.
        </em>
      </Text>
    </Stack>
  );
};

// =============================================================================
// Wrapper — horizontal stepper + shared header sliders
// =============================================================================

const STEP_LABELS = [
  "O baralho de anos históricos",
  "Um aposentado simulado",
  "1000 aposentados ao mesmo tempo",
  "Procurando a taxa segura",
] as const;

const FireMethodologyWalkthrough = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [rate, setRate] = useState(0.04);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const rateActive = RATE_RELEVANT_STEPS.has(activeStep);

  const renderStepContent = (idx: number) => {
    switch (idx) {
      case 0:
        return <DeckStep horizon={horizon} />;
      case 1:
        return <SingleTrialStep rate={rate} horizon={horizon} />;
      case 2:
        return <EnsembleStep rate={rate} horizon={horizon} />;
      case 3:
        return <SearchStep horizon={horizon} />;
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
          Os 4 passos abaixo mostram, em uma carteira de exemplo (R$ 1M em
          70% ações + 30% renda fixa, sem FII), como a taxa segura é
          encontrada via bootstrap histórico.
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
            Taxa de retirada anual:{" "}
            <strong>{(rate * 100).toFixed(1)}%</strong>
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

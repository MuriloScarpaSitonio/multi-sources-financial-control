import {
  buildAgeInBondsPortfolio,
  buildPortfolio,
  eligibleMonths,
  historicalMonthsForSlice,
  historicalSourceForMonth,
  type PortfolioSlice,
} from "../../Home/firePortfolio";
import { FIRE_RETURN_SERIES } from "../../Home/fireReturns";
import type {
  FireReturnSeriesKey,
  ReturnCategory,
} from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";

export const DATASET_LABELS: Record<FireReturnSeriesKey, string> = {
  IBOV: "IBOV",
  IFIX: "IFIX",
  SPY: "SPY · S&P 500",
  VTI: "VTI · mercado americano",
  VT: "VT · ações globais",
  VWRL: "VWRL/VWRA · ações globais",
  BTC: "Bitcoin",
  CMBI10: "CMBI 10 · cesta cripto",
  CDI: "CDI",
  IMA_S: "IMA-S",
  IRF_M_1: "IRF-M 1 · até 1 ano",
  IRF_M_1_PLUS: "IRF-M 1+ · acima de 1 ano",
  IMA_B_5: "IMA-B 5 · até 5 anos",
  IMA_B_5_PLUS: "IMA-B 5+ · acima de 5 anos",
  IMA_GERAL_EX_C: "IMA-Geral ex-C",
  CASH: "Dinheiro · sem rendimento",
};
type DatasetKind =
  | "ações brasileiras"
  | "ações americanas"
  | "ações globais"
  | "fundos imobiliários"
  | "cripto"
  | "renda fixa"
  | "dinheiro sem rendimento";
const DATASET_KINDS: Record<FireReturnSeriesKey, DatasetKind> = {
  IBOV: "ações brasileiras",
  SPY: "ações americanas",
  VTI: "ações americanas",
  VT: "ações globais",
  VWRL: "ações globais",
  IFIX: "fundos imobiliários",
  BTC: "cripto",
  CMBI10: "cripto",
  CDI: "renda fixa",
  IMA_S: "renda fixa",
  IRF_M_1: "renda fixa",
  IRF_M_1_PLUS: "renda fixa",
  IMA_B_5: "renda fixa",
  IMA_B_5_PLUS: "renda fixa",
  IMA_GERAL_EX_C: "renda fixa",
  CASH: "dinheiro sem rendimento",
};
const CATEGORY_KINDS: Record<ReturnCategory, DatasetKind> = {
  BR_EQUITY: "ações brasileiras",
  US_EQUITY: "ações americanas",
  GLOBAL_EQUITY: "ações globais",
  FII: "fundos imobiliários",
  CRYPTO: "cripto",
  FIXED_CDI: "renda fixa",
  FIXED_SELIC: "renda fixa",
  FIXED_PREFIXED: "renda fixa",
  FIXED_IPCA: "renda fixa",
};
export const datasetChoiceWarning = (
  category: ReturnCategory,
  series: FireReturnSeriesKey,
) =>
  series === "CASH"
    ? "Escolha atípica: esses ativos serão simulados sem rendimento, perdendo poder de compra com a inflação."
    : CATEGORY_KINDS[category] === DATASET_KINDS[series]
      ? null
      : null;
export const DATASET_KEYS = Object.keys(
  DATASET_LABELS,
) as FireReturnSeriesKey[];
export const earlierDatasetsFor = (primary: FireReturnSeriesKey) => {
  const start = FIRE_RETURN_SERIES[primary].months[0];
  return start
    ? DATASET_KEYS.filter((key) =>
        FIRE_RETURN_SERIES[key].months.some((month) => month < start),
      )
    : [];
};

export const DATASET_GROUPS: {
  label: string;
  subgroups: { label: string; datasets: FireReturnSeriesKey[] }[];
}[] = [
  {
    label: "Renda variável BR",
    subgroups: [
      { label: "Ações", datasets: ["IBOV"] },
      { label: "FII", datasets: ["IFIX"] },
    ],
  },
  {
    label: "Renda variável EUA",
    subgroups: [{ label: "Ações", datasets: ["SPY", "VTI"] }],
  },
  {
    label: "Renda variável Global",
    subgroups: [{ label: "Ações", datasets: ["VT", "VWRL"] }],
  },
  {
    label: "Renda fixa",
    subgroups: [
      { label: "Pós-fixada", datasets: ["CDI", "IMA_S"] },
      { label: "Prefixada", datasets: ["IRF_M_1", "IRF_M_1_PLUS"] },
      { label: "IPCA", datasets: ["IMA_B_5", "IMA_B_5_PLUS"] },
      { label: "Diversificada", datasets: ["IMA_GERAL_EX_C"] },
    ],
  },
  {
    label: "Cripto",
    subgroups: [
      { label: "Ativo individual", datasets: ["BTC"] },
      { label: "Cesta de ativos", datasets: ["CMBI10"] },
    ],
  },
  {
    label: "Dinheiro",
    subgroups: [{ label: "Sem rendimento", datasets: ["CASH"] }],
  },
];

export const formatHistoricalMonth = (month: string | null | undefined) =>
  month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : "—";
export const datasetPeriodLabel = (key: FireReturnSeriesKey) => {
  const months = FIRE_RETURN_SERIES[key].months;
  return `${formatHistoricalMonth(months[0])}–${formatHistoricalMonth(months.at(-1))}`;
};
// Separate phases retain the calendar intersection used by each allocation.
export const historicalPhases = (
  base: readonly PortfolioSlice[],
  showAgeInBonds: boolean,
) =>
  (showAgeInBonds
    ? [
        { label: "Acumulação", portfolio: [...base] },
        {
          label: "Aposentadoria · antes dos 100 anos",
          portfolio: buildAgeInBondsPortfolio(base, 0.5),
        },
        {
          label: "A partir dos 100 anos, se alcançados",
          portfolio: buildAgeInBondsPortfolio(base, 0),
        },
      ]
    : [{ label: "Histórico usado", portfolio: [...base] }]
  ).map((phase) => ({ ...phase, months: eligibleMonths(phase.portfolio) }));

export const historicalSummary = (
  allocation: readonly FireAllocationBucket[],
  preferences: Required<FirePlanningPreferences>,
  showAgeInBonds = false,
) => {
  const base = buildPortfolio(allocation, preferences);
  // The age-in-bonds path can introduce a missing equity or bond sleeve.
  // Both sleeves' datasets are needed over the changing allocation.
  const portfolio = showAgeInBonds ? buildAgeInBondsPortfolio(base, 0.5) : base;
  const additional = [
    ...new Set(
      portfolio
        .filter(
          (slice) =>
            slice.constrainsSample &&
            !base.some((original) => original.series === slice.series),
        )
        .map((slice) => slice.series),
    ),
  ];
  const months = eligibleMonths(portfolio);
  const period = {
    first: months[0] ?? null,
    last: months.at(-1) ?? null,
    count: months.length,
  };
  const sources = portfolio
    .filter((slice) => slice.constrainsSample)
    .map((slice) => ({ slice, months: historicalMonthsForSlice(slice) }));
  const limiting = sources.flatMap((source) => {
    const keys: FireReturnSeriesKey[] = [];
    if (period.first && source.months[0] === period.first)
      keys.push(historicalSourceForMonth(source.slice, period.first));
    if (
      period.last &&
      source.months.at(-1) === period.last &&
      sources.some((other) => (other.months.at(-1) ?? "") > period.last!)
    )
      keys.push(historicalSourceForMonth(source.slice, period.last));
    return keys;
  });
  return {
    period,
    phases: historicalPhases(base, showAgeInBonds),
    months,
    additional,
    limiting: [...new Set(limiting)],
    label: `${formatHistoricalMonth(period.first)}–${formatHistoricalMonth(period.last)}`,
  };
};

export const CATEGORY_LABELS: Record<ReturnCategory, string> = {
  BR_EQUITY: "Renda variável BR",
  US_EQUITY: "Renda variável EUA",
  GLOBAL_EQUITY: "Renda variável Global",
  FII: "FII",
  CRYPTO: "Cripto",
  FIXED_CDI: "Renda fixa CDI",
  FIXED_SELIC: "Renda fixa Selic",
  FIXED_PREFIXED: "Renda fixa prefixada",
  FIXED_IPCA: "Renda fixa IPCA",
};

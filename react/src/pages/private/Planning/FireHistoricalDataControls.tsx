import { useMemo, type Ref } from "react";

import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import { Colors, FontSizes, Text } from "../../../design-system";
import { buildPortfolio, eligiblePeriod } from "../Home/firePortfolio";
import { FIRE_RETURN_SERIES } from "../Home/fireReturns";
import type {
  CryptoProxy,
  FireReturnSeriesKey,
  GlobalEquityProxy,
  ReturnCategory,
  UsEquityProxy,
} from "../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "./api";
import type { FireAllocationBucket } from "./fireAllocation";

type Preferences = Required<FirePlanningPreferences>;
type ProxyPreferenceKey =
  | "us_equity_proxy"
  | "global_equity_proxy"
  | "crypto_proxy";

const CATEGORY_LABELS: Record<ReturnCategory, string> = {
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

const SERIES_LABELS: Partial<Record<FireReturnSeriesKey, string>> = {
  IMA_S: "IMA-S",
  IRF_M_1: "IRF-M 1",
  IRF_M_1_PLUS: "IRF-M 1+",
  IMA_B_5: "IMA-B 5",
  IMA_B_5_PLUS: "IMA-B 5+",
  IMA_GERAL_EX_C: "IMA-Geral ex-C",
};

const fixedIncomeSeriesLabel = (
  category: ReturnCategory,
  series: readonly FireReturnSeriesKey[],
) => {
  const selected = new Set(series);
  if (
    category === "FIXED_IPCA" &&
    selected.has("IMA_B_5") &&
    selected.has("IMA_B_5_PLUS")
  ) {
    return "IMA-B 5 (até 5 anos) e IMA-B 5+ (acima de 5 anos)";
  }
  if (
    category === "FIXED_PREFIXED" &&
    selected.has("IRF_M_1") &&
    selected.has("IRF_M_1_PLUS")
  ) {
    return "IRF-M 1 (até 1 ano) e IRF-M 1+ (acima de 1 ano)";
  }
  return series.map((key) => SERIES_LABELS[key] ?? key).join(" e ");
};

export const PROXY_OPTIONS = {
  US_EQUITY: [
    { value: "SPY", label: "SPY", detail: "S&P 500; histórico mais longo" },
    { value: "VTI", label: "VTI", detail: "mercado americano mais amplo" },
  ],
  GLOBAL_EQUITY: [
    {
      value: "VT",
      label: "VT",
      detail: "global all-cap, incluindo small caps",
    },
    {
      value: "VWRL",
      label: "VWRL/VWRA",
      detail: "large/mid-cap, mais próximo de VWRA",
    },
  ],
  CRYPTO: [
    {
      value: "BTC",
      label: "Bitcoin",
      detail: "ativo único; histórico mais longo",
    },
    {
      value: "CMBI10",
      label: "CMBI 10",
      detail: "cesta diversificada; histórico mais curto",
    },
  ],
} as const;

const proxyPreferenceKey: Record<
  keyof typeof PROXY_OPTIONS,
  ProxyPreferenceKey
> = {
  US_EQUITY: "us_equity_proxy",
  GLOBAL_EQUITY: "global_equity_proxy",
  CRYPTO: "crypto_proxy",
};

const firstYear = (series: readonly FireReturnSeriesKey[]) => {
  const firstMonths = series
    .map((key) => FIRE_RETURN_SERIES[key].months[0])
    .filter((month): month is string => Boolean(month));
  return firstMonths.length
    ? Math.max(...firstMonths.map((month) => Number(month.slice(0, 4))))
    : null;
};

const FireHistoricalDataControls = ({
  allocation,
  preferences,
  onChange,
  showShortPeriodWarning = true,
  controlsRef,
}: {
  allocation: readonly FireAllocationBucket[];
  preferences: Preferences;
  onChange: <K extends keyof Preferences>(
    field: K,
    value: Preferences[K],
  ) => void;
  showShortPeriodWarning?: boolean;
  controlsRef?: Ref<HTMLDivElement>;
}) => {
  const owned = useMemo(() => {
    const byCategory = new Map<ReturnCategory, FireAllocationBucket[]>();
    allocation.forEach((bucket) => {
      if (bucket.category === "CASH" || bucket.total <= 0) return;
      const current = byCategory.get(bucket.category) ?? [];
      current.push(bucket);
      byCategory.set(bucket.category, current);
    });
    return Array.from(byCategory.entries());
  }, [allocation]);

  const period = useMemo(
    () => eligiblePeriod(buildPortfolio(allocation, preferences)),
    [allocation, preferences],
  );

  const setIncluded = (category: ReturnCategory, included: boolean) => {
    const excluded = preferences.excluded_return_categories;
    onChange(
      "excluded_return_categories",
      included
        ? excluded.filter((item) => item !== category)
        : Array.from(new Set([...excluded, category])),
    );
  };

  return (
    <Stack gap={1.5} ref={controlsRef} tabIndex={controlsRef ? -1 : undefined}>
      <Text size={FontSizes.SMALL}>Dados históricos</Text>
      {owned.map(([category, buckets]) => {
        const selectable = category in PROXY_OPTIONS;
        const preferenceKey = selectable
          ? proxyPreferenceKey[category as keyof typeof PROXY_OPTIONS]
          : null;
        const series = selectable
          ? [preferences[preferenceKey!] as FireReturnSeriesKey]
          : Array.from(
              new Set(
                buckets
                  .map((bucket) => bucket.series)
                  .filter((key): key is FireReturnSeriesKey => key !== null),
              ),
            );
        const since = firstYear(series);

        return (
          <Stack
            key={category}
            direction="row"
            alignItems="center"
            gap={1}
            flexWrap="wrap"
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={
                    !preferences.excluded_return_categories.includes(category)
                  }
                  onChange={(event) =>
                    setIncluded(category, event.target.checked)
                  }
                />
              }
              label={CATEGORY_LABELS[category]}
            />
            {selectable && preferenceKey ? (
              <Select
                size="small"
                value={preferences[preferenceKey]}
                onChange={(event) =>
                  onChange(
                    preferenceKey,
                    event.target.value as UsEquityProxy &
                      GlobalEquityProxy &
                      CryptoProxy,
                  )
                }
              >
                {PROXY_OPTIONS[category as keyof typeof PROXY_OPTIONS].map(
                  (option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label} — {option.detail}
                    </MenuItem>
                  ),
                )}
              </Select>
            ) : (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                {fixedIncomeSeriesLabel(category, series)}
              </Text>
            )}
            {since !== null && (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                desde {since}
              </Text>
            )}
          </Stack>
        );
      })}

      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Período resultante: {period.first?.slice(0, 4) ?? "—"}–
        {period.last?.slice(0, 4) ?? "—"}
      </Text>
      {showShortPeriodWarning && period.count > 0 && period.count < 120 && (
        <Alert severity="warning">
          O período histórico é curto; a simulação continua disponível, mas o
          resultado é menos robusto.
        </Alert>
      )}
    </Stack>
  );
};

export default FireHistoricalDataControls;

import { useId, useMemo, useState } from "react";
import IconButton from "@mui/material/IconButton";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Colors,
  FontSizes,
  getColor,
  getFontSize,
  Text,
} from "../../../../design-system";
import { buildPortfolio, fireAllocationKey } from "../../Home/firePortfolio";
import { FIRE_RETURN_SERIES } from "../../Home/fireReturns";
import type { FireReturnSeriesKey } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import { CATEGORY_LABELS } from "./fireHistoricalDatasets";
import type { FireAllocationBucket } from "../fireAllocation";
import {
  DATASET_LABELS,
  formatHistoricalMonth,
  datasetPeriodLabel,
  datasetChoiceWarning,
  historicalSummary,
  earlierDatasetsFor,
} from "./fireHistoricalDatasets";

import FireDatasetPills from "./FireDatasetPills";
import FireHistoricalCoverage from "./FireHistoricalCoverage";

type Overrides = Record<string, FireReturnSeriesKey>;
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const FireHistoricalDrawer = ({
  allocation,
  preferences,
  showAgeInBonds = false,
  onApply,
  onClose,
}: {
  allocation: readonly FireAllocationBucket[];
  preferences: Required<FirePlanningPreferences>;
  showAgeInBonds?: boolean;
  onApply: (overrides: Overrides, fallbacks: Overrides) => void;
  onClose: () => void;
}) => {
  const titleId = useId();
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(() => ({
    ...preferences.historical_series_overrides,
  }));
  const [fallbacks, setFallbacks] = useState<Overrides>(() => ({
    ...preferences.historical_series_fallbacks,
  }));
  const [fallbackFields, setFallbackFields] = useState<Record<string, boolean>>(
    {},
  );
  const [explanationOpen, setExplanationOpen] = useState<
    Record<string, boolean>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const draft = useMemo(
    () => ({
      ...preferences,
      historical_series_overrides: overrides,
      historical_series_fallbacks: fallbacks,
    }),
    [preferences, overrides, fallbacks],
  );
  const summary = historicalSummary(allocation, draft, showAgeInBonds);
  const buckets = allocation
    .filter((bucket) => bucket.category !== "CASH" && bucket.total > 0)
    .sort((left, right) => right.total - left.total);
  const total = allocation
    .filter((bucket) => bucket.total > 0)
    .reduce((sum, bucket) => sum + bucket.total, 0);

  const activeKey =
    selectedBucket ?? (buckets[0] ? fireAllocationKey(buckets[0]) : null);
  const bucketName = (bucket: FireAllocationBucket) => {
    if (bucket.category === "CASH") return "Dinheiro";
    const label = CATEGORY_LABELS[bucket.category];
    return (bucket.category === "FIXED_PREFIXED" ||
      bucket.category === "FIXED_IPCA") &&
      bucket.series
      ? `${label} · ${DATASET_LABELS[bucket.series]}`
      : label;
  };
  const assetType = (bucket: FireAllocationBucket) => {
    if (bucket.category.startsWith("FIXED_")) return "Renda fixa";
    if (bucket.category === "BR_EQUITY" || bucket.category === "FII")
      return "Renda variável BR";
    if (bucket.category === "US_EQUITY") return "Renda variável EUA";
    if (bucket.category === "GLOBAL_EQUITY") return "Renda variável Global";
    return bucket.category === "CRYPTO" ? "Cripto" : "Dinheiro";
  };
  const assetTypes = [...new Set(buckets.map(assetType))]
    .map((label) => ({
      label,
      buckets: buckets.filter((bucket) => assetType(bucket) === label),
    }))
    .sort(
      (left, right) =>
        right.buckets.reduce((sum, bucket) => sum + bucket.total, 0) -
        left.buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    );
  const activeType = assetTypes.find((type) =>
    type.buckets.some((bucket) => fireAllocationKey(bucket) === activeKey),
  );
  const subgroupName = (bucket: FireAllocationBucket) =>
    bucket.category === "BR_EQUITY"
      ? "Ações"
      : bucketName(bucket).replace(/^Renda fixa /, "");
  const hasChanges = buckets.some((bucket) => {
    const before = buildPortfolio([bucket], preferences)[0];
    const after = buildPortfolio([bucket], draft)[0];
    return (
      before.series !== after.series ||
      before.fallbackSeries !== after.fallbackSeries
    );
  });

  return (
    <Drawer
      open
      anchor="right"
      onClose={onClose}
      PaperProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
        sx: {
          width: { xs: "100%", sm: "min(960px, 95vw)" },
          maxWidth: "100%",
          backgroundColor: getColor(Colors.neutral900),
          backgroundImage: "none",
        },
      }}
    >
      <Stack sx={{ height: "100%", minHeight: 0 }}>
        <Stack
          gap={1}
          sx={{
            p: 2.5,
            borderBottom: `1px solid ${getColor(Colors.neutral600)}`,
          }}
        >
          <Text id={titleId} size={FontSizes.SMALL}>
            Configurar históricos
          </Text>
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
            Consulte o histórico principal e complemente os meses anteriores.
          </Text>
          <Stack gap={0.25} aria-live="polite">
            <Text size={FontSizes.EXTRA_SMALL}>
              Período disponível: {summary.label}
            </Text>
            {showAgeInBonds && (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                Período da aposentadoria antes dos 100 anos. A acumulação e a
                fase a partir dos 100 anos podem usar períodos diferentes,
                indicados em cada complemento.
              </Text>
            )}
            {summary.limiting.length > 0 && (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                Limitado por:{" "}
                {summary.limiting.map((key) => DATASET_LABELS[key]).join(", ")}
              </Text>
            )}
            {summary.additional.length > 0 && (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                Idade em Renda Fixa também usa:{" "}
                {summary.additional
                  .map((key) => DATASET_LABELS[key])
                  .join(", ")}
                , para o grupo ausente na carteira.
              </Text>
            )}
            {summary.period.count === 0 && (
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.danger100}>
                Os históricos selecionados não têm meses em comum.
              </Text>
            )}
          </Stack>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "140px minmax(0, 1fr)",
              sm: "210px minmax(0, 1fr)",
            },
            flex: 1,
            minHeight: 0,
          }}
        >
          <Stack
            role="tablist"
            aria-label="Tipos de ativos"
            aria-orientation="vertical"
            gap={1.5}
            sx={{
              p: 1,
              overflowY: "auto",
              borderRight: `1px solid ${getColor(Colors.neutral600)}`,
            }}
          >
            {assetTypes.map((type, index) => {
              const key = type.label;
              return (
                <Button
                  key={key}
                  role="tab"
                  id={`${titleId}-${key}`}
                  aria-controls={`${titleId}-detail`}
                  aria-selected={activeType?.label === key}
                  tabIndex={activeType?.label === key ? 0 : -1}
                  variant={activeType?.label === key ? "brand" : "brand-text"}
                  onClick={() =>
                    setSelectedBucket(fireAllocationKey(type.buckets[0]))
                  }
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowDown"
                        ? (index + 1) % assetTypes.length
                        : event.key === "ArrowUp"
                          ? (index - 1 + assetTypes.length) % assetTypes.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? assetTypes.length - 1
                              : null;
                    if (next === null) return;
                    event.preventDefault();
                    const nextType = assetTypes[next];
                    const nextKey = nextType.label;
                    setSelectedBucket(fireAllocationKey(nextType.buckets[0]));
                    document.getElementById(`${titleId}-${nextKey}`)?.focus();
                  }}
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    px: 1,
                    py: 0.5,
                    fontSize: getFontSize(FontSizes.EXTRA_SMALL),
                  }}
                >
                  {type.label}
                </Button>
              );
            })}
          </Stack>
          <Stack
            role="tabpanel"
            id={`${titleId}-detail`}
            aria-labelledby={
              activeType ? `${titleId}-${activeType.label}` : undefined
            }
            gap={2}
            sx={{ p: { xs: 1.5, sm: 2.5 }, overflowY: "auto", minWidth: 0 }}
          >
            {buckets.length === 0 && (
              <Text size={FontSizes.EXTRA_SMALL}>
                Não há ativos com histórico para configurar.
              </Text>
            )}
            {buckets
              .filter((bucket) => fireAllocationKey(bucket) === activeKey)
              .map((bucket) => {
                if (bucket.category === "CASH") return null;
                const key = fireAllocationKey(bucket);
                const name = bucketName(bucket);
                const slice = buildPortfolio([bucket], draft)[0];
                const series = slice.series;
                const earlierDatasets = earlierDatasetsFor(series);
                const complementMonths = slice.fallbackSeries
                  ? FIRE_RETURN_SERIES[slice.fallbackSeries].months.filter(
                      (month) => month < FIRE_RETURN_SERIES[series].months[0],
                    )
                  : [];
                const fallbackWarning = slice.fallbackSeries
                  ? datasetChoiceWarning(bucket.category, slice.fallbackSeries)
                  : null;
                const assets = bucket.assets;
                const choiceWarning = datasetChoiceWarning(
                  bucket.category,
                  series,
                );
                return (
                  <Stack
                    key={key}
                    gap={0.75}
                    sx={{
                      pb: 2,
                      borderBottom: `1px solid ${getColor(Colors.neutral600)}`,
                    }}
                  >
                    {activeType && (
                      <Stack
                        role="group"
                        aria-label="Subgrupos da carteira"
                        gap={1}
                      >
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          color={Colors.neutral300}
                        >
                          Subgrupo da carteira
                        </Text>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1.5}
                          flexWrap="wrap"
                        >
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            {activeType.buckets.map((bucket) => {
                              const key = fireAllocationKey(bucket);
                              return (
                                <Button
                                  key={key}
                                  size="small"
                                  variant={
                                    activeKey === key ? "brand" : "brand-text"
                                  }
                                  aria-pressed={activeKey === key}
                                  onClick={() => setSelectedBucket(key)}
                                  sx={{
                                    borderRadius: 999,
                                    px: 1.25,
                                    py: 0.5,
                                    fontSize: getFontSize(
                                      FontSizes.EXTRA_SMALL,
                                    ),
                                  }}
                                >
                                  {subgroupName(bucket)}
                                </Button>
                              );
                            })}
                          </Stack>
                          <Stack
                            direction="row"
                            alignItems="center"
                            gap={1}
                            sx={{ marginLeft: "auto" }}
                          >
                            {assets && (
                              <Button
                                variant="brand-text"
                                size="small"
                                aria-expanded={!!expanded[key]}
                                onClick={() =>
                                  setExpanded((current) => ({
                                    ...current,
                                    [key]: !current[key],
                                  }))
                                }
                                endIcon={
                                  <ExpandMoreIcon
                                    sx={{
                                      transform: expanded[key]
                                        ? "rotate(180deg)"
                                        : undefined,
                                    }}
                                  />
                                }
                                sx={{
                                  alignSelf: "flex-start",
                                  p: 0,
                                  fontSize: getFontSize(FontSizes.EXTRA_SMALL),
                                }}
                              >
                                {assets.length}{" "}
                                {assets.length === 1
                                  ? "ativo afetado"
                                  : "ativos afetados"}
                              </Button>
                            )}
                            <Text
                              size={FontSizes.EXTRA_SMALL}
                              color={Colors.neutral300}
                              extraStyle={{ whiteSpace: "nowrap" }}
                            >
                              {money.format(bucket.total)} ·{" "}
                              {percent.format(bucket.total / total)}
                            </Text>
                          </Stack>
                        </Stack>
                        {assets ? (
                          <>
                            {expanded[key] && (
                              <Stack gap={0.75}>
                                {assets.map((asset) => (
                                  <Box
                                    key={asset.id}
                                    sx={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 1,
                                    }}
                                  >
                                    <Stack>
                                      <Text size={FontSizes.EXTRA_SMALL}>
                                        {asset.code}
                                      </Text>
                                      {asset.description && (
                                        <Text
                                          size={FontSizes.EXTRA_SMALL}
                                          color={Colors.neutral300}
                                        >
                                          {asset.description}
                                        </Text>
                                      )}
                                    </Stack>
                                    <Text
                                      size={FontSizes.EXTRA_SMALL}
                                      extraStyle={{ whiteSpace: "nowrap" }}
                                    >
                                      {money.format(asset.total)}
                                    </Text>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </>
                        ) : (
                          <Text
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral300}
                          >
                            Detalhamento dos ativos indisponível.
                          </Text>
                        )}
                      </Stack>
                    )}
                    <Text
                      size={FontSizes.EXTRA_SMALL}
                      color={Colors.neutral300}
                    >
                      Histórico principal
                    </Text>
                    <FireDatasetPills
                      key={`${key}-primary`}
                      label={`Histórico para ${name}`}
                      value={series}
                      lockSubgroup
                      onChange={(value) =>
                        setOverrides((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                    <Text
                      size={FontSizes.EXTRA_SMALL}
                      color={Colors.neutral300}
                      extraStyle={{ textAlign: "center" }}
                    >
                      {datasetPeriodLabel(series)}
                    </Text>
                    {choiceWarning && (
                      <Stack
                        direction="row"
                        gap={0.75}
                        alignItems="flex-start"
                        role="status"
                      >
                        <WarningAmberIcon
                          sx={{
                            fontSize: getFontSize(FontSizes.SMALL),
                            color: "warning.main",
                            flexShrink: 0,
                          }}
                        />
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          color={Colors.neutral300}
                        >
                          {choiceWarning}
                        </Text>
                      </Stack>
                    )}
                    {(earlierDatasets.length > 0 || slice.fallbackSeries) && (
                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={0.75}
                        sx={{ mt: 2 }}
                      >
                        {slice.fallbackSeries ? (
                          <Text
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral300}
                          >
                            Histórico anterior
                          </Text>
                        ) : (
                          <Button
                            variant="brand-text"
                            size="small"
                            startIcon={
                              fallbackFields[key] ? <RemoveIcon /> : <AddIcon />
                            }
                            aria-expanded={!!fallbackFields[key]}
                            aria-controls={`${titleId}-${key}-earlier`}
                            sx={{
                              p: 0,
                              fontSize: getFontSize(FontSizes.EXTRA_SMALL),
                            }}
                            onClick={() =>
                              setFallbackFields((current) => ({
                                ...current,
                                [key]: !current[key],
                              }))
                            }
                          >
                            Complementar histórico anterior
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          aria-label="O que significa complementar histórico anterior?"
                          aria-expanded={!!explanationOpen[key]}
                          aria-controls={`${titleId}-${key}-explanation`}
                          onClick={() =>
                            setExplanationOpen((current) => ({
                              ...current,
                              [key]: !current[key],
                            }))
                          }
                          sx={{ p: 0, color: getColor(Colors.neutral300) }}
                        >
                          <InfoOutlinedIcon
                            sx={{ fontSize: getFontSize(FontSizes.SMALL) }}
                          />
                        </IconButton>
                      </Stack>
                    )}
                    {explanationOpen[key] && (
                      <Text
                        id={`${titleId}-${key}-explanation`}
                        size={FontSizes.EXTRA_SMALL}
                        color={Colors.neutral300}
                        extraStyle={{
                          padding: 12,
                          backgroundColor: getColor(Colors.neutral800),
                          borderRadius: 4,
                        }}
                      >
                        Usa outro índice apenas nos meses anteriores ao início
                        do principal. Ex.: se o principal começa em maio de
                        2004, um complemento pode acrescentar meses de janeiro
                        de 1995 a abril de 2004. Depois, usa o principal. Os
                        outros grupos da carteira ainda podem limitar o período
                        da simulação.
                      </Text>
                    )}
                    {fallbackFields[key] && earlierDatasets.length > 0 && (
                      <Stack
                        id={`${titleId}-${key}-earlier`}
                        sx={{
                          p: 2,
                          mt: 1,
                          backgroundColor: getColor(Colors.neutral800),
                          borderRadius: 1,
                        }}
                      >
                        <FireDatasetPills
                          datasets={earlierDatasets}
                          key={`${key}-earlier`}
                          label={`Histórico anterior para ${name}`}
                          value={slice.fallbackSeries ?? ""}
                          onChange={(value) => {
                            setFallbacks((current) => ({
                              ...current,
                              [key]: value,
                            }));
                            setFallbackFields((current) => ({
                              ...current,
                              [key]: false,
                            }));
                          }}
                        />
                      </Stack>
                    )}
                    {!earlierDatasets.length && !slice.fallbackSeries && (
                      <Text
                        size={FontSizes.EXTRA_SMALL}
                        color={Colors.neutral300}
                        extraStyle={{ marginTop: 1 }}
                      >
                        Este histórico já começa no primeiro mês disponível. Não
                        há período anterior para complementar.
                      </Text>
                    )}
                    {slice.fallbackSeries && (
                      <Stack
                        gap={1}
                        sx={{
                          p: 1.5,
                          mt: 1,
                          backgroundColor: getColor(Colors.neutral800),
                          borderRadius: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Text size={FontSizes.EXTRA_SMALL}>
                            {DATASET_LABELS[slice.fallbackSeries]} ·{" "}
                            {complementMonths.length
                              ? `${formatHistoricalMonth(complementMonths[0])}–${formatHistoricalMonth(complementMonths.at(-1))}`
                              : "sem meses anteriores"}
                          </Text>
                          <Stack direction="row" gap={1}>
                            {earlierDatasets.length > 0 && (
                              <Button
                                size="small"
                                variant="brand-text"
                                aria-label={`Alterar histórico anterior para ${name}`}
                                onClick={() =>
                                  setFallbackFields((current) => ({
                                    ...current,
                                    [key]: !current[key],
                                  }))
                                }
                              >
                                Alterar
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="brand-text"
                              aria-label={`Remover histórico anterior para ${name}`}
                              onClick={() => {
                                setFallbacks((current) => {
                                  const next = { ...current };
                                  delete next[key];
                                  return next;
                                });
                                setFallbackFields((current) => ({
                                  ...current,
                                  [key]: false,
                                }));
                              }}
                            >
                              Remover
                            </Button>
                          </Stack>
                        </Stack>
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          color={Colors.neutral300}
                        >
                          {complementMonths.length
                            ? `Depois desse período, usa ${DATASET_LABELS[series]}.`
                            : "Este complemento não acrescenta meses ao histórico principal."}
                        </Text>
                        {fallbackWarning && (
                          <Text
                            role="status"
                            size={FontSizes.EXTRA_SMALL}
                            color={Colors.neutral300}
                          >
                            {fallbackWarning}
                          </Text>
                        )}
                        <Box
                          component="details"
                          sx={{
                            fontSize: getFontSize(FontSizes.EXTRA_SMALL),
                            color: getColor(Colors.neutral300),
                          }}
                        >
                          <Box
                            component="summary"
                            sx={{ cursor: "pointer", mb: 1 }}
                          >
                            Período usado na simulação
                          </Box>
                          <Stack gap={1}>
                            {summary.phases
                              .filter((phase) =>
                                phase.portfolio.some(
                                  (item) =>
                                    item.category === slice.category &&
                                    item.series === slice.series,
                                ),
                              )
                              .map((phase) => (
                                <FireHistoricalCoverage
                                  key={phase.label}
                                  label={phase.label}
                                  slice={slice}
                                  months={phase.months}
                                />
                              ))}
                          </Stack>
                        </Box>
                      </Stack>
                    )}
                  </Stack>
                );
              })}
          </Stack>
        </Box>
        <Stack
          direction="row"
          justifyContent="flex-end"
          gap={1}
          sx={{ p: 2, borderTop: `1px solid ${getColor(Colors.neutral600)}` }}
        >
          <Button variant="brand-text" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="brand"
            disabled={!hasChanges || summary.period.count === 0}
            onClick={() => onApply(overrides, fallbacks)}
          >
            Aplicar
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};
export default FireHistoricalDrawer;

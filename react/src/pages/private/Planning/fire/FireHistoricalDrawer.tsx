import { useId, useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  getFontSize,
  Text,
} from "../../../../design-system";
import { buildPortfolio, fireAllocationKey } from "../../Home/firePortfolio";
import type { FireReturnSeriesKey } from "../../Home/fireReturnTypes";
import type { FirePlanningPreferences } from "../api";
import { CATEGORY_LABELS } from "./fireHistoricalDatasets";
import type { FireAllocationBucket } from "../fireAllocation";
import {
  DATASET_LABELS,
  datasetPeriodLabel,
  datasetChoiceWarning,
  historicalSummary,
} from "./fireHistoricalDatasets";

import FireDatasetSelect from "./FireDatasetSelect";
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
  const [overrides, setOverrides] = useState<Overrides>(() => ({
    ...preferences.historical_series_overrides,
  }));
  const [fallbacks, setFallbacks] = useState<Overrides>(() => ({
    ...preferences.historical_series_fallbacks,
  }));
  const [fallbackFields, setFallbackFields] = useState<Record<string, boolean>>(
    {},
  );
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
          width: { xs: "100%", sm: 560 },
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
            Escolha o histórico usado para simular cada grupo. Os ativos e seus
            valores continuam os mesmos.
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
        <Stack
          gap={2}
          sx={{ p: 2.5, overflowY: "auto", flex: 1, minHeight: 0 }}
        >
          {buckets.length === 0 && (
            <Text size={FontSizes.EXTRA_SMALL}>
              Não há ativos com histórico para configurar.
            </Text>
          )}
          {buckets.map((bucket) => {
            if (bucket.category === "CASH") return null;
            const key = fireAllocationKey(bucket);
            const label = CATEGORY_LABELS[bucket.category];
            const split =
              bucket.category === "FIXED_PREFIXED" ||
              bucket.category === "FIXED_IPCA";
            const name =
              split && bucket.series
                ? `${label} · ${DATASET_LABELS[bucket.series]}`
                : label;
            const slice = buildPortfolio([bucket], draft)[0];
            const series = slice.series;
            const fallbackWarning = slice.fallbackSeries
              ? datasetChoiceWarning(bucket.category, slice.fallbackSeries)
              : null;
            const assets = bucket.assets;
            const choiceWarning = datasetChoiceWarning(bucket.category, series);
            return (
              <Stack
                key={key}
                gap={0.75}
                sx={{
                  pb: 2,
                  borderBottom: `1px solid ${getColor(Colors.neutral600)}`,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  gap={1}
                  flexWrap="wrap"
                >
                  <Text
                    size={FontSizes.EXTRA_SMALL}
                    weight={FontWeights.MEDIUM}
                  >
                    {name}
                  </Text>
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                    {money.format(bucket.total)} ·{" "}
                    {percent.format(bucket.total / total)}
                  </Text>
                </Stack>
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                  Histórico principal
                </Text>
                <FireDatasetSelect
                  label={`Histórico para ${name}`}
                  value={series}
                  onChange={(value) =>
                    setOverrides((current) => ({ ...current, [key]: value }))
                  }
                />
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
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
                {slice.fallbackSeries || fallbackFields[key] ? (
                  <Stack gap={0.75}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Text
                        size={FontSizes.EXTRA_SMALL}
                        color={Colors.neutral300}
                      >
                        Histórico anterior
                      </Text>
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
                    <FireDatasetSelect
                      label={`Histórico anterior para ${name}`}
                      value={slice.fallbackSeries ?? ""}
                      onChange={(value) =>
                        setFallbacks((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                    {fallbackWarning && (
                      <Text
                        role="status"
                        size={FontSizes.EXTRA_SMALL}
                        color={Colors.neutral300}
                      >
                        Histórico anterior: {fallbackWarning}
                      </Text>
                    )}
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
                ) : (
                  <Button
                    variant="brand-text"
                    size="small"
                    sx={{
                      alignSelf: "flex-start",
                      p: 0,
                      fontSize: getFontSize(FontSizes.EXTRA_SMALL),
                    }}
                    onClick={() =>
                      setFallbackFields((current) => ({
                        ...current,
                        [key]: true,
                      }))
                    }
                  >
                    Complementar histórico anterior
                  </Button>
                )}
                {assets ? (
                  <>
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
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                    Detalhamento dos ativos indisponível.
                  </Text>
                )}
              </Stack>
            );
          })}
        </Stack>
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
            disabled={summary.period.count === 0}
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

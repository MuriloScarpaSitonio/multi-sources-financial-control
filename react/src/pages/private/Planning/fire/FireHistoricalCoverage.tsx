import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import {
  Colors,
  FontSizes,
  getColor,
  InfoIconTooltip,
  Text,
} from "../../../../design-system";
import {
  historicalMonthsForSlice,
  historicalSourceForMonth,
  type PortfolioSlice,
} from "../../Home/firePortfolio";
import { FIRE_RETURN_SERIES } from "../../Home/fireReturns";
import {
  DATASET_LABELS,
  formatHistoricalMonth,
} from "./fireHistoricalDatasets";
const percentage = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const FireHistoricalCoverage = ({
  slice,
  months,
  label = "Histórico usado",
}: {
  label?: string;
  slice: PortfolioSlice;
  months: readonly string[];
}) => {
  if (!slice.fallbackSeries) return null;
  if (!months.length)
    return (
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
        Sem meses em comum para calcular a contribuição.
      </Text>
    );
  const fallbackMonths = months.filter(
    (month) => historicalSourceForMonth(slice, month) !== slice.series,
  );
  const primaryMonths = months.filter(
    (month) => historicalSourceForMonth(slice, month) === slice.series,
  );
  const share = months.length ? fallbackMonths.length / months.length : 0;
  const primary = FIRE_RETURN_SERIES[slice.series].months;
  const contributesEarlier =
    historicalMonthsForSlice(slice).length > primary.length;
  const range = (values: readonly string[]) =>
    values.length
      ? `${formatHistoricalMonth(values[0])}–${formatHistoricalMonth(values.at(-1))}`
      : "fora do período disponível";
  return (
    <Stack gap={0.5}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Text size={FontSizes.EXTRA_SMALL}>{label}</Text>
        <InfoIconTooltip text="O histórico anterior é uma aproximação. Seus meses podem aparecer em qualquer etapa da simulação. Blocos de 12 meses podem atravessar a troca de índice; essa sequência combina dois históricos diferentes." />
      </Stack>
      <Box
        aria-hidden
        sx={{
          display: "flex",
          height: 6,
          borderRadius: 1,
          overflow: "hidden",
          backgroundColor: getColor(Colors.neutral600),
        }}
      >
        <Box
          sx={{
            width: `${share * 100}%`,
            backgroundColor: getColor(Colors.neutral400),
          }}
        />
        <Box sx={{ flex: 1, backgroundColor: getColor(Colors.brand) }} />
      </Box>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
        {percentage.format(share)} complementado ·{" "}
        {percentage.format(1 - share)} principal
      </Text>
      {fallbackMonths.length > 0 && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          {DATASET_LABELS[slice.fallbackSeries]}: {range(fallbackMonths)} →{" "}
          {DATASET_LABELS[slice.series]}: {range(primaryMonths)}
        </Text>
      )}
      {!fallbackMonths.length && (
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          {contributesEarlier
            ? "Os outros grupos limitam o período; o complemento não é usado neste período."
            : "Este índice não acrescenta meses anteriores ao histórico principal."}
        </Text>
      )}
    </Stack>
  );
};
export default FireHistoricalCoverage;

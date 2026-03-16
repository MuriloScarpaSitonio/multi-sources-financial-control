import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";
import type { ReportAggregatedByTypeDataItem } from "../Assets/Reports/types";

const STOCK_TYPES = new Set(["Ação BR", "Ação EUA", "Cripto", "FII"]);
const BOND_TYPES = new Set(["Renda fixa BR"]);

const GalenoLinearProgress = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

const sliderSx = {
  width: 100,
  "& .MuiSlider-thumb": {
    width: 14,
    height: 14,
    backgroundColor: getColor(Colors.brand500),
    "&:hover, &.Mui-focusVisible": {
      boxShadow: `0 0 0 8px ${getColor(Colors.brand500)}33`,
    },
  },
  "& .MuiSlider-track": {
    backgroundColor: getColor(Colors.brand500),
    border: "none",
  },
  "& .MuiSlider-rail": {
    backgroundColor: getColor(Colors.brand500),
  },
};

const computeYearsToBuffer = (
  stocks: number,
  currentBuffer: number,
  targetBuffer: number,
  transferRate: number,
): number => {
  if (currentBuffer >= targetBuffer) return 0;
  if (stocks <= 0 || transferRate <= 0) return Infinity;
  let buffer = currentBuffer;
  let remainingStocks = stocks;
  let years = 0;
  const maxYears = 100;
  while (buffer < targetBuffer && years < maxYears) {
    const transfer = remainingStocks * (transferRate / 100);
    buffer += transfer;
    remainingStocks -= transfer;
    years++;
  }
  return years;
};

const GalenoIndicator = ({
  reportData,
  bankAmount,
  avgExpenses,
  isLoading,
  transferRate,
  onTransferRateChange,
  targetBufferYears,
  onTargetBufferYearsChange,
}: {
  reportData: ReportAggregatedByTypeDataItem[];
  bankAmount: number;
  avgExpenses: number;
  isLoading: boolean;
  transferRate: number;
  onTransferRateChange: (value: number) => void;
  targetBufferYears: number;
  onTargetBufferYearsChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();

  const stocksTotal = reportData
    .filter((item) => STOCK_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.total, 0);

  const bondsTotal = reportData
    .filter((item) => BOND_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.total, 0);

  const currentBuffer = bondsTotal + bankAmount;
  const annualExpenses = avgExpenses * 12;
  const targetBuffer = annualExpenses * targetBufferYears;
  const progress = targetBuffer > 0 ? (currentBuffer / targetBuffer) * 100 : 0;
  const yearsToReady = computeYearsToBuffer(
    stocksTotal,
    currentBuffer,
    targetBuffer,
    transferRate,
  );

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const bufferFormatted = hideValues ? "***" : formatCurrency(currentBuffer);
  const targetFormatted = hideValues ? "***" : formatCurrency(targetBuffer);
  const yearsLabel =
    yearsToReady === 0
      ? "Pronto!"
      : yearsToReady >= 100
        ? "100+ anos"
        : `${yearsToReady} anos`;
  const tooltipTitle =
    `Galeno: acumule ${targetBufferYears} anos de despesas em renda fixa ` +
    `transferindo ${transferRate}% das ações por ano. ` +
    `Atual: ${bufferFormatted}. Meta: ${targetFormatted}. ` +
    `Tempo estimado: ${yearsLabel}.`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <GalenoLinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Galeno (combinação)
            </Text>
            {hideValues ? (
              <Skeleton
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "60px",
                }}
                animation={false}
              />
            ) : (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.SEMI_BOLD}
                size={FontSizes.SEMI_SMALL}
              >
                {progress.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
      </Tooltip>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {yearsLabel} para atingir {targetBufferYears} anos de despesas em renda fixa
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Transf. {transferRate}%/ano
        </Text>
        <Slider
          value={transferRate}
          onChange={(_, value) => onTransferRateChange(value as number)}
          min={3}
          max={15}
          step={1}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Colchão: {targetBufferYears} anos
        </Text>
        <Slider
          value={targetBufferYears}
          onChange={(_, value) => onTargetBufferYearsChange(value as number)}
          min={3}
          max={10}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
      </Stack>
    </Stack>
  );
};

export default GalenoIndicator;

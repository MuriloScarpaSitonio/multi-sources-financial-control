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

const ProgressBar = styled(LinearProgress)(({ value }) => ({
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

const computeYearsUntilDepletion = (
  portfolio: number,
  annualExpenses: number,
  realReturn: number,
): number => {
  if (portfolio <= 0 || annualExpenses <= 0) return 0;
  let balance = portfolio;
  let years = 0;
  const maxYears = 100;
  while (balance > 0 && years < maxYears) {
    balance = balance * (1 + realReturn) - annualExpenses;
    years++;
  }
  return years;
};

const ConstantDollarIndicator = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
  realReturn,
  onRealReturnChange,
  targetYears,
  onTargetYearsChange,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
  realReturn: number;
  onRealReturnChange: (value: number) => void;
  targetYears: number;
  onTargetYearsChange: (value: number) => void;
}) => {
  const { hideValues } = useHideValues();

  const annualExpenses = avgExpenses * 12;
  const depletionYears = computeYearsUntilDepletion(
    patrimonyTotal,
    annualExpenses,
    realReturn / 100,
  );
  const progress = targetYears > 0 ? (depletionYears / targetYears) * 100 : 0;

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const monthlyFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const depletionLabel = depletionYears >= 100 ? "100+" : depletionYears;
  const tooltipTitle =
    `Retirada constante: retire suas despesas atuais (${monthlyFormatted}/mês) ajustadas pela inflação. ` +
    `Com retorno real de ${realReturn.toFixed(1)}% a.a., o portfólio sustenta ${depletionLabel} anos. ` +
    `Meta: ${targetYears} anos.`;

  return (
    <Stack gap={0.5}>
      <Tooltip title={tooltipTitle} arrow placement="top">
        <div style={{ position: "relative" }}>
          <ProgressBar
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
              Retirada constante
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
          {depletionLabel} anos estimados · meta: {targetYears} anos ·{" "}
          {hideValues ? "***" : formatCurrency(avgExpenses)}/mês
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Retorno real: {realReturn.toFixed(1)}%
        </Text>
        <Slider
          value={realReturn}
          onChange={(_, value) => onRealReturnChange(value as number)}
          min={1}
          max={8}
          step={0.5}
          size="medium"
          sx={sliderSx}
        />
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Horizonte: {targetYears} anos
        </Text>
        <Slider
          value={targetYears}
          onChange={(_, value) => onTargetYearsChange(value as number)}
          min={20}
          max={50}
          step={5}
          size="medium"
          sx={sliderSx}
        />
      </Stack>
    </Stack>
  );
};

export default ConstantDollarIndicator;

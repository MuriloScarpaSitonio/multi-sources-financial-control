import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, {
  linearProgressClasses,
} from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";

import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
  getColor,
} from "../../../../design-system";
import { useHideValues } from "../../../../hooks/useHideValues";

const BorderLinearProgress = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value === 100
        ? getColor(Colors.danger200)
        : getColor(Colors.brand),
  },
}));

const ExpenseRevenuesRatioLinearProgress = ({
  percentage,
  isLoading,
}: {
  percentage: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  return (
    <Tooltip
      title="Percentual das receitas do mês atual comprometido com despesas"
      arrow
      placement="top"
    >
      <Stack gap={0.5}>
        <div style={{ position: "relative" }}>
          <BorderLinearProgress
            variant="determinate"
            value={Math.min(percentage, 100)}
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
              Despesas / Receitas
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
              {percentage.toLocaleString("pt-br", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              %
            </Text>
            )}
          </Stack>
        </div>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Proporção das receitas comprometida com despesas neste mês
        </Text>
      </Stack>
    </Tooltip>
  );
};

export default ExpenseRevenuesRatioLinearProgress;

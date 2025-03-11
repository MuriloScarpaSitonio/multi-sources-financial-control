import Skeleton from "@mui/material/Skeleton";
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

const BorderLinearProgress = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral200),
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
}) =>
  isLoading ? (
    <Skeleton height={48} sx={{ borderRadius: "10px" }} />
  ) : (
    <div style={{ position: "relative" }}>
      <BorderLinearProgress
        variant="determinate"
        value={Math.min(percentage, 100)}
      />
      <Text
        extraStyle={{
          position: "absolute",
          top: "10%",
          left: "94%",
          transform: "translateX(-50%)",
        }}
        color={Colors.neutral900}
        weight={FontWeights.SEMI_BOLD}
        size={FontSizes.SEMI_SMALL}
      >
        {percentage.toLocaleString("pt-br", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        %
      </Text>
    </div>
  );

export default ExpenseRevenuesRatioLinearProgress;

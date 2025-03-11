import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { Text, getColor } from "../../../../design-system";
import * as enums from "../../../../design-system/enums";
import { useHideValues } from "../../../../hooks/useHideValues";

const RoiSecondaryIndicator = ({
  value,
  variant,
  isLoading,
}: {
  value?: number;
  variant: "success" | "danger";
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {isLoading || hideValues ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "75%" }}
          animation={hideValues ? false : "pulse"}
        />
      ) : (
        <Text
          weight={enums.FontWeights.LIGHT}
          size={enums.FontSizes.EXTRA_SMALL}
        >
          <Text
            weight={enums.FontWeights.LIGHT}
            size={enums.FontSizes.EXTRA_SMALL}
            color={
              variant === "success"
                ? enums.Colors.brand
                : enums.Colors.danger200
            }
            display="inline"
          >
            {`RS ${value?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
            })} `}
          </Text>
          posições abertas
        </Text>
      )}
    </Stack>
  );
};

export default RoiSecondaryIndicator;

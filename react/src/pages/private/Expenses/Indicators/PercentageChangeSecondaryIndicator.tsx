import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { InfoIconTooltip, Text } from "../../../../design-system/components";
import * as enums from "../../../../design-system/enums";
import { getColor } from "../../../../design-system/utils";
import { useCallback } from "react";
const ArrowUpIcon = ({ isInverse = false }: { isInverse?: boolean }) => (
  <ArrowDropUpIcon
    sx={{
      color: isInverse
        ? getColor(enums.Colors.danger200)
        : getColor(enums.Colors.brand),
      marginLeft: "-8px !important",
    }}
  />
);

const ArrowDownIcon = ({ isInverse = false }: { isInverse?: boolean }) => (
  <ArrowDropDownIcon
    sx={{
      color: isInverse
        ? getColor(enums.Colors.brand)
        : getColor(enums.Colors.danger200),
      marginLeft: "-8px !important",
    }}
  />
);

const PercentageChangeSecondaryIndicator = ({
  value,
  variant,
  isLoading,
  tooltipText,
  isIconInverse = false,
}: {
  value?: number;
  variant: "success" | "danger";
  isLoading: boolean;
  tooltipText?: string;
  isIconInverse?: boolean;
}) => {
  const getPercentageIcon = useCallback(() => {
    if (variant === "success") {
      if (isIconInverse) return <ArrowDownIcon isInverse />;
      return <ArrowUpIcon />;
    }
    return isIconInverse ? <ArrowUpIcon isInverse /> : <ArrowDownIcon />;
  }, [variant, isIconInverse]);

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {isLoading ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "50%" }}
        />
      ) : (
        <>
          {getPercentageIcon()}
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
              {`${value?.toLocaleString("pt-br", {
                minimumFractionDigits: 2,
              })}% `}
            </Text>
            da média do último ano
          </Text>
          {tooltipText && <InfoIconTooltip text={tooltipText} />}
        </>
      )}
    </Stack>
  );
};

export default PercentageChangeSecondaryIndicator;

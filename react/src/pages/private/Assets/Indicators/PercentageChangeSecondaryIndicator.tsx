import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { InfoIconTooltip, Text } from "../../../../design-system/components";
import * as enums from "../../../../design-system/enums";
import { getColor } from "../../../../design-system/utils";

const PercentageChangeSecondaryIndicator = ({
  value,
  variant,
  isLoading,
  tooltipText,
  text = "em relação a média dos últimos 12 meses",
}: {
  value?: number;
  variant: "success" | "danger";
  isLoading: boolean;
  tooltipText?: string;
  text?: string;
}) => {
  const percentageIcon =
    variant === "success" ? (
      <ArrowDropUpIcon
        sx={{
          color: getColor(enums.Colors.brand),
          marginLeft: "-8px !important",
        }}
      />
    ) : (
      <ArrowDropDownIcon
        sx={{
          color: getColor(enums.Colors.danger200),
          marginLeft: "-8px !important",
        }}
      />
    );

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {isLoading ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "50%" }}
        />
      ) : (
        <>
          {percentageIcon}
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
            {text}
          </Text>
          {tooltipText && <InfoIconTooltip text={tooltipText} />}
        </>
      )}
    </Stack>
  );
};

export default PercentageChangeSecondaryIndicator;

import { ReactNode } from "react";

import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";

import { InfoIconTooltip, Text } from "../../design-system/components";
import * as enums from "../../design-system/enums";
import { getColor } from "../../design-system/utils";

const Error = () => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <ErrorOutlineOutlinedIcon
      sx={{ color: getColor(enums.Colors.danger200) }}
    />
    <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.EXTRA_SMALL}>
      Falha ao carregar. Por favor, tente novamente mais tarde.
    </Text>
  </Stack>
);

export const Indicator = ({
  title,
  tooltipText,
  Icon,
  value,
  secondaryIndicator,
  variant,
  isLoading,
  isError,
}: {
  title: string;
  tooltipText?: string;
  Icon: typeof SvgIcon;
  value?: number;
  secondaryIndicator: ReactNode;
  variant: "success" | "danger";
  isLoading: boolean;
  isError: boolean;
}) => {
  const content = (
    <Stack spacing={1.5}>
      {isLoading ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "75%" }}
        />
      ) : (
        <Text size={enums.FontSizes.REGULAR}>
          {`R$ ${value?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}`}
        </Text>
      )}
      {secondaryIndicator}
    </Stack>
  );
  const titleContent = tooltipText ? (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.SMALL}>
        {title}
      </Text>
      {tooltipText && <InfoIconTooltip text={tooltipText} />}
    </Stack>
  ) : (
    <Text weight={enums.FontWeights.LIGHT} size={enums.FontSizes.SMALL}>
      {title}
    </Text>
  );
  return (
    <Stack
      sx={{
        background: getColor(enums.Colors.neutral900),
        py: 2,
        px: 5,
        height: 140,
      }}
      spacing={1}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={8}
      >
        {titleContent}
        <Icon
          fontSize="medium"
          sx={{
            color: getColor(
              variant === "success"
                ? enums.Colors.brand
                : enums.Colors.danger200,
            ),
          }}
        />
      </Stack>
      {isError ? <Error /> : content}
    </Stack>
  );
};

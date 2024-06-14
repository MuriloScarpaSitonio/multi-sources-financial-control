import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";

import { useQuery } from "@tanstack/react-query";

import {
  IncomesIndicator,
  PercentageChangeSecondaryIndicator,
} from "./Indicators";
import { Indicator } from "../components";
import { getIndicators as getAssetsIndicators } from "../../../api/assets";
import { InvestmentUpIcon } from "../../../design-system/icons";
import * as enums from "../../../design-system/enums";
import { getColor } from "../../../design-system/utils";
import { Text } from "../../../design-system/components";
import Reports from "./Reports";

const RoiSecondaryIndicator = ({
  value,
  variant,
  isLoading,
}: {
  value?: number;
  variant: "success" | "danger";
  isLoading: boolean;
}) => {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {isLoading ? (
        <Skeleton
          sx={{ bgcolor: getColor(enums.Colors.neutral300), width: "50%" }}
        />
      ) : (
        <>
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
            Posições abertas
          </Text>
        </>
      )}
    </Stack>
  );
};

const Assets = () => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["assets-indicators"],
    queryFn: getAssetsIndicators,
  });

  return (
    <>
      <Grid container spacing={8} sx={{ width: "100%" }}>
        <Grid item xs={4}>
          <Indicator
            title="Patrimônio"
            tooltipText="Test!"
            value={data?.total}
            secondaryIndicator={
              <PercentageChangeSecondaryIndicator
                value={3.5}
                variant="success"
                isLoading={isPending}
              />
            }
            Icon={MonetizationOnOutlinedIcon}
            variant="success"
            isLoading={isPending}
            isError={isError}
          />
        </Grid>
        <Grid item xs={4}>
          <Indicator
            title="ROI"
            tooltipText="Lucro/Prejuízo"
            value={data?.ROI}
            secondaryIndicator={
              <RoiSecondaryIndicator
                value={data?.ROI_opened}
                variant={data && data.ROI_opened > 0 ? "success" : "danger"}
                isLoading={isPending}
              />
            }
            Icon={InvestmentUpIcon as typeof SvgIcon}
            variant={data && data.ROI > 0 ? "success" : "danger"}
            isLoading={isPending}
            isError={isError}
          />
        </Grid>
        <Grid item xs={4}>
          <IncomesIndicator />
        </Grid>
      </Grid>
      <Reports />
    </>
  );
};

export default Assets;

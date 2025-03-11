import type { ReactNode } from "react";

import Grid from "@mui/material/Grid";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";

import { Indicator } from "../../components";
import { InvestmentUpIcon } from "../../../../design-system/icons";
import { useAssetsIndicators } from "./hooks";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";
import RoiSecondaryIndicator from "./RoiSecondaryIndicator";

const Indicators = ({ extra }: { extra: ReactNode }) => {
  const { data, isPending, isError } = useAssetsIndicators();

  return (
    <Grid container spacing={4}>
      <Grid item xs={4}>
        <Indicator
          title="Patrimônio"
          value={data?.total}
          secondaryIndicator={
            <PercentageChangeSecondaryIndicator
              value={data?.total_diff_percentage}
              variant={
                // this is essentially the diff between total and the last entry
                // of useAssetsTotalInvestedHistory
                // TODO: consider calculating this in the FE to avoid hitting
                // the DB twice
                data && data.total_diff_percentage > 0 ? "success" : "danger"
              }
              isLoading={isPending}
              text="no último mês"
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
          title="ROI (Lucro/Prejuízo)"
          value={(data?.ROI_opened ?? 0) + (data?.ROI_closed ?? 0)}
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
        {extra}
      </Grid>
    </Grid>
  );
};

export default Indicators;
